"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Badge from "@/components/badge";
import Avatar from "@/components/avatar";
import { useAuth } from "@/context/auth-context";
import { logAudit, notify } from "@/lib/activity";
import type { LeaveRequest, LeaveStatus } from "@/lib/types";
import { cn, daysBetween, formatDate, fullName } from "@/lib/utils";
import { CalendarDays, Check, X } from "lucide-react";

type Filter = "all" | LeaveStatus;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

const DEFAULT_ALLOCATION: Record<LeaveRequest["leave_type"], number> = {
  annual: 20,
  sick: 10,
  casual: 5,
  maternity: 90,
  unpaid: 0,
  other: 0,
};

function addToBalance(supabase: ReturnType<typeof createClient>, req: LeaveRequest, days: number) {
  const year = req.balance_year ?? new Date(req.start_date).getFullYear();
  return supabase
    .from("leave_balances")
    .select("*")
    .eq("user_id", req.user_id)
    .eq("balance_year", year)
    .eq("leave_type", req.leave_type)
    .maybeSingle()
    .then(async ({ data }) => {
      if (data) {
        await supabase
          .from("leave_balances")
          .update({ used: (data.used ?? 0) + days, updated_at: new Date().toISOString() })
          .eq("id", data.id);
      } else {
        await supabase.from("leave_balances").insert({
          user_id: req.user_id,
          balance_year: year,
          leave_type: req.leave_type,
          allocated: DEFAULT_ALLOCATION[req.leave_type],
          used: days,
          carried_forward: 0,
        });
      }
    });
}

export default function HrLeavePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("leave_requests")
      .select("*, applicant:app_users(first_name, last_name, department, position, profile_picture_path)")
      .order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (req: LeaveRequest, status: "approved" | "rejected") => {
    if (status === "rejected" && !confirm("Reject this leave request?")) return;
    if (status === "approved" && !confirm(`Approve this request for ${req.working_days ?? daysBetween(req.start_date, req.end_date)} day(s)?`)) return;
    const supabase = createClient();
    if (status === "approved") {
      const days = req.working_days ?? daysBetween(req.start_date, req.end_date);
      await addToBalance(supabase, req, days);
      await notify({
        userId: req.user_id,
        type: "leave",
        title: "Leave approved",
        body: `Your ${req.leave_type.replace("_", " ")} request (${formatDate(req.start_date)} – ${formatDate(req.end_date)}) was approved.`,
        entityType: "leave_requests",
        entityId: req.id,
      });
    } else {
      await notify({
        userId: req.user_id,
        type: "leave",
        title: "Leave request rejected",
        body: `Your ${req.leave_type.replace("_", " ")} request (${formatDate(req.start_date)} – ${formatDate(req.end_date)}) was rejected.`,
        entityType: "leave_requests",
        entityId: req.id,
      });
    }
    await supabase
      .from("leave_requests")
      .update({ status, decided_by: user?.employee_id ?? null, decided_at: new Date().toISOString() })
      .eq("id", req.id);
    await logAudit({
      user,
      action: `leave.${status}`,
      entityType: "leave_requests",
      entityId: req.id,
      summary: `${status === "approved" ? "Approved" : "Rejected"} ${req.leave_type} leave for ${req.user_id} (${req.start_date} → ${req.end_date})`,
      oldValue: { status: req.status },
      newValue: { status, working_days: req.working_days },
    });
    await load();
  };

  const filtered = items.filter((i) => filter === "all" || i.status === filter);
  const pending = items.filter((i) => i.status === "pending").length;

  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Leave Management</h1>
          <p className="text-sm text-gray-500">Review and decide on all leave requests.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/portal/hr/leave-calendar" className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
            Calendar
          </Link>
          <Link href="/portal/hr/leave-balances" className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
            Balances
          </Link>
        </div>
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm ring-1 ring-gray-200">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition",
              filter === f.id ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100"
            )}
          >
            {f.label}
            {f.id === "pending" && pending > 0 && ` (${pending})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-300 py-16 text-gray-500">
          <CalendarDays size={28} />
          <p className="text-sm">No leave requests here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Employee</th>
                <th className="hidden px-5 py-3 font-semibold md:table-cell">Type</th>
                <th className="px-5 py-3 font-semibold">Period</th>
                <th className="hidden px-5 py-3 font-semibold sm:table-cell">Days</th>
                <th className="hidden px-5 py-3 font-semibold lg:table-cell">Reason</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar firstName={r.applicant?.first_name ?? "?"} lastName={r.applicant?.last_name ?? ""} picturePath={r.applicant?.profile_picture_path} size="sm" />
                      <div>
                        <p className="font-medium text-gray-900">
                          {r.applicant && "first_name" in r.applicant
                            ? fullName(r.applicant.first_name, r.applicant.last_name)
                            : "Unknown"}
                        </p>
                        <p className="text-xs text-gray-500">{r.applicant?.department ?? "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-5 py-3 capitalize text-gray-700 md:table-cell">
                    {r.leave_type.replace("_", " ")}
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {formatDate(r.start_date)} — {formatDate(r.end_date)}
                  </td>
                  <td className="hidden px-5 py-3 text-gray-500 sm:table-cell">
                    {daysBetween(r.start_date, r.end_date)}
                  </td>
                  <td className="hidden max-w-xs truncate px-5 py-3 text-gray-500 lg:table-cell">
                    {r.reason ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    <Badge value={r.status} />
                  </td>
                  <td className="px-5 py-3">
                    {r.status === "pending" ? (
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => decide(r, "approved")}
                          title="Approve"
                          className="rounded-lg bg-green-50 p-1.5 text-green-600 hover:bg-green-100"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => decide(r, "rejected")}
                          title="Reject"
                          className="rounded-lg bg-red-50 p-1.5 text-red-600 hover:bg-red-100"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <span className="block text-right text-xs text-gray-300">
                        {r.decided_by ? `by ${r.decided_by}` : "—"}
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