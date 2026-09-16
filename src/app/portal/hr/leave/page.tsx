"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Badge from "@/components/badge";
import Avatar from "@/components/avatar";
import { useAuth } from "@/context/auth-context";
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
    const supabase = createClient();
    await supabase
      .from("leave_requests")
      .update({ status, decided_by: user?.employee_id ?? null, decided_at: new Date().toISOString() })
      .eq("id", req.id);
    await load();
  };

  const filtered = items.filter((i) => filter === "all" || i.status === filter);
  const pending = items.filter((i) => i.status === "pending").length;

  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Leave Management</h1>
        <p className="text-sm text-gray-500">Review and decide on all leave requests.</p>
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