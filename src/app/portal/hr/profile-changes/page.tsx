"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Badge from "@/components/badge";
import Avatar from "@/components/avatar";
import { useAuth } from "@/context/auth-context";
import { logAudit, notify } from "@/lib/activity";
import type { ProfileChangeRequest, ReviewStatus } from "@/lib/types";
import { cn, formatDate, fullName } from "@/lib/utils";
import { FilePen, Check, X, Loader2 } from "lucide-react";

type Filter = "all" | ReviewStatus;

export default function HrProfileChangesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ProfileChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("profile_change_requests")
      .select("*, applicant:app_users(first_name, last_name, department, position, profile_picture_path)")
      .order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (req: ProfileChangeRequest, status: "approved" | "rejected") => {
    if (status === "approved" && !confirm(`Apply "${req.field_label} → ${req.new_value}" to the employee profile?`)) return;
    setBusyId(req.id);
    const supabase = createClient();
    if (status === "approved") {
      await supabase
        .from("app_users")
        .update({ [req.field]: req.new_value })
        .eq("id", req.user_id);
    }
    await supabase
      .from("profile_change_requests")
      .update({ status, decided_by: user?.employee_id ?? null, decided_at: new Date().toISOString() })
      .eq("id", req.id);
    await logAudit({
      user,
      action: `profile_change.${status}`,
      entityType: "profile_change_requests",
      entityId: req.id,
      summary: `${status === "approved" ? "Applied" : "Rejected"} profile change ${req.field_label} → ${req.new_value}`,
      oldValue: { field: req.field, value: req.current_value, status: req.status },
      newValue: { field: req.field, value: req.new_value, status },
    });
    await notify({
      userId: req.user_id,
      type: "profile",
      title: status === "approved" ? "Profile change applied" : "Profile change rejected",
      body:
        status === "approved"
          ? `${req.field_label} was updated to "${req.new_value}".`
          : `${req.field_label} change to "${req.new_value}" was not approved.`,
      entityType: "profile_change_requests",
      entityId: req.id,
    });
    setBusyId(null);
    await load();
  };

  const filtered = items.filter((i) => filter === "all" || i.status === filter);
  const pending = items.filter((i) => i.status === "pending").length;

  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Profile change requests</h1>
        <p className="text-sm text-gray-500">
          Employees request changes to important fields. Approving applies the new value to their profile.
        </p>
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm ring-1 ring-gray-200">
        {(["all", "pending", "approved", "rejected"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium capitalize transition",
              filter === f ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100"
            )}
          >
            {f}
            {f === "pending" && pending > 0 && ` (${pending})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-300 py-16 text-gray-500">
          <FilePen size={28} />
          <p className="text-sm">No profile change requests here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Employee</th>
                <th className="px-5 py-3 font-semibold">Field</th>
                <th className="px-5 py-3 font-semibold">Change</th>
                <th className="hidden px-5 py-3 font-semibold sm:table-cell">Requested</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar firstName={c.applicant?.first_name ?? "?"} lastName={c.applicant?.last_name ?? ""} picturePath={c.applicant?.profile_picture_path} size="sm" />
                      <div>
                        <p className="font-medium text-gray-900">
                          {c.applicant && "first_name" in c.applicant
                            ? fullName(c.applicant.first_name, c.applicant.last_name)
                            : "Unknown"}
                        </p>
                        <p className="text-xs text-gray-500">{c.applicant?.department ?? "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-700">{c.field_label}</td>
                  <td className="px-5 py-3">
                    <span className="text-gray-400 line-through">{c.current_value ?? "—"}</span>
                    <span className="mx-1 text-gray-400">→</span>
                    <span className="font-medium text-gray-900">{c.new_value}</span>
                  </td>
                  <td className="hidden px-5 py-3 text-gray-500 sm:table-cell">{formatDate(c.created_at)}</td>
                  <td className="px-5 py-3">
                    <Badge value={c.status} />
                  </td>
                  <td className="px-5 py-3">
                    {c.status === "pending" ? (
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => decide(c, "approved")}
                          disabled={busyId === c.id}
                          title="Approve & apply"
                          className="rounded-lg bg-green-50 p-1.5 text-green-600 hover:bg-green-100 disabled:opacity-40"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => decide(c, "rejected")}
                          disabled={busyId === c.id}
                          title="Reject"
                          className="rounded-lg bg-red-50 p-1.5 text-red-600 hover:bg-red-100 disabled:opacity-40"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : busyId === c.id ? (
                      <div className="flex justify-end">
                        <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                      </div>
                    ) : (
                      <span className="block text-right text-xs text-gray-300">
                        {c.decided_by ? `by ${c.decided_by}` : "—"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}