"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/avatar";
import Badge from "@/components/badge";
import DocumentList from "@/components/document-list";
import Modal from "@/components/modal";
import { useAuth } from "@/context/auth-context";
import { deleteFile } from "@/lib/supabase/storage";
import { cn } from "@/lib/utils";
import type { AppUser, Document } from "@/lib/types";
import { formatDate, fullName } from "@/lib/utils";
import { ClipboardCheck, Check, X, RefreshCcw, Loader2 } from "lucide-react";

type Tab = "pending" | "rejected";

export default function RegistrationsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("pending");
  const [items, setItems] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AppUser | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [rejectReason, setRejectReason] = useState("");
  const [deciding, setDeciding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("app_users")
      .select("*")
      .eq("status", tab)
      .order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    load();
    setSelected(null);
  }, [load]);

  const open = async (appUser: AppUser) => {
    setSelected(appUser);
    setError(null);
    setRejectReason("");
    const supabase = createClient();
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", appUser.id)
      .order("created_at", { ascending: false });
    setDocuments(data ?? []);
  };

  const decide = async (status: "verified" | "rejected") => {
    if (!selected) return;
    if (status === "rejected" && !confirm("Reject this registration?")) return;
    setDeciding(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("app_users")
        .update({
          status,
          rejection_reason: status === "rejected" ? rejectReason.trim() || null : null,
          decided_by: user?.employee_id ?? null,
          decided_at: new Date().toISOString(),
        })
        .eq("id", selected.id);
      if (updateError) throw updateError;
      setSelected(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeciding(false);
    }
  };

  const freeId = async () => {
    if (!selected) return;
    if (!confirm(`Remove this registration and free the employee ID ${selected.employee_id} so it can be reissued?`)) return;
    setDeciding(true);
    setError(null);
    try {
      const supabase = createClient();
      // Best-effort cleanup of uploaded pending files.
      await Promise.all(
        documents.map((d) => deleteFile("hr-documents", d.file_path).catch(() => {}))
      );
      if (selected.profile_picture_path?.startsWith("pending/")) {
        await deleteFile("hr-avatars", selected.profile_picture_path).catch(() => {});
      }
      await supabase.from("app_users").delete().eq("id", selected.id);
      await supabase
        .from("employee_ids")
        .update({ status: "unused", claimed_at: null })
        .eq("employee_id", selected.employee_id);
      setSelected(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeciding(false);
    }
  };

  const badges: Record<Tab, string> = {
    pending:
      "flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition text-amber-700 bg-white",
    rejected: "flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition text-red-700 bg-white",
  };

  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Registrations</h1>
        <p className="text-sm text-gray-500">
          Review new employee account details and documents, then verify the
          employee to activate their account.
        </p>
      </div>

      <div className="mb-5 flex gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-gray-200">
        {(["pending", "rejected"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn(badges[t], tab === t && "bg-gray-100")}>
            {t === "pending" ? "Pending" : "Rejected"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-300 py-16 text-gray-500">
          <ClipboardCheck size={28} />
          <p className="text-sm">
            {tab === "pending" ? "No pending registrations." : "No rejected registrations."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((r) => (
            <button
              key={r.id}
              onClick={() => open(r)}
              className={cn(
                "rounded-2xl border bg-white p-5 text-left transition hover:border-indigo-300 hover:shadow-md",
                selected?.id === r.id ? "border-indigo-400 ring-2 ring-indigo-100" : "border-gray-200"
              )}
            >
              <div className="flex items-center gap-3">
                <Avatar firstName={r.first_name} lastName={r.last_name} picturePath={r.profile_picture_path} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-900">{fullName(r.first_name, r.last_name)}</p>
                  <p className="text-xs text-gray-500">
                    {r.employee_id}
                    {r.created_at && <span> · {formatDate(r.created_at)}</span>}
                  </p>
                </div>
                <Badge value={r.status} />
              </div>
              <div className="mt-3 space-y-1 text-sm text-gray-600">
                <p>{r.position ?? "No position"}{r.department && ` · ${r.department}`}</p>
                {r.email && <p className="text-xs text-gray-500">{r.email}</p>}
                {r.status === "rejected" && r.rejection_reason && (
                  <p className="text-xs text-red-500">Reason: {r.rejection_reason}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected ? `Review ${selected.first_name} ${selected.last_name}` : ""} wide>
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar firstName={selected.first_name} lastName={selected.last_name} picturePath={selected.profile_picture_path} size="lg" />
              <div>
                <p className="flex items-center gap-2 font-semibold text-gray-900">
                  {fullName(selected.first_name, selected.last_name)}
                  <Badge value={selected.status} />
                </p>
                <p className="text-sm text-gray-500">Employee ID: {selected.employee_id}</p>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-gray-50 p-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-400">Email</dt>
                <dd className="break-all font-medium text-gray-900">{selected.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-400">Phone</dt>
                <dd className="font-medium text-gray-900">{selected.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-400">Date of birth</dt>
                <dd className="font-medium text-gray-900">{formatDate(selected.date_of_birth)}</dd>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <dt className="text-xs uppercase tracking-wide text-gray-400">Department</dt>
                <dd className="font-medium text-gray-900">{selected.department ?? "—"}</dd>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <dt className="text-xs uppercase tracking-wide text-gray-400">Position</dt>
                <dd className="font-medium text-gray-900">{selected.position ?? "—"}</dd>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <dt className="text-xs uppercase tracking-wide text-gray-400">Applicant address</dt>
                <dd className="break-all font-medium text-gray-900">{selected.address ?? "—"}</dd>
              </div>
            </dl>

            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">Uploaded documents</p>
              <DocumentList documents={documents} />
            </div>

            {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

            {rejectReason !== null && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Rejection reason (optional)
                </label>
                <input
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  placeholder="e.g. Missing ID scan"
                />
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
              <button
                onClick={freeId}
                disabled={deciding}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                title="Delete this registration and make the employee ID available again"
              >
                <RefreshCcw size={14} />
                Free employee ID
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => decide("rejected")}
                  disabled={deciding}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <X size={15} />
                  Reject
                </button>
                <button
                  onClick={() => decide("verified")}
                  disabled={deciding}
                  className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {deciding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check size={15} />}
                  Verify & register employee
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}