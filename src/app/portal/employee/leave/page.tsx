"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import Badge from "@/components/badge";
import { LEAVE_TYPES, type LeaveRequest, type LeaveType } from "@/lib/types";
import { daysBetween, formatDate } from "@/lib/utils";
import { CalendarDays, Loader2, Send } from "lucide-react";

export default function EmployeeLeavePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaveType, setLeaveType] = useState<LeaveType>("annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user) return null;

  const request = async (e: FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      setError("Choose both start and end dates.");
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError("End date must be on or after the start date.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: insertError } = await supabase.from("leave_requests").insert({
        user_id: user.id,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim() || null,
      });
      if (insertError) throw insertError;
      setStartDate("");
      setEndDate("");
      setReason("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200";

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <h1 className="text-2xl font-bold">My Leave</h1>
      <p className="text-sm text-gray-500">
        Request leave — your request will be reviewed by the HR manager.
      </p>

      <form onSubmit={request} className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
        <h3 className="mb-4 font-semibold">New leave request</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Leave type</label>
            <select
              className={inputCls}
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as LeaveType)}
            >
              {LEAVE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">From</label>
            <input
              type="date"
              required
              className={inputCls}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">To</label>
            <input
              type="date"
              required
              className={inputCls}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">Reason</label>
          <textarea
            className={inputCls}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send size={15} />}
          {saving ? "Submitting…" : "Submit request"}
        </button>
      </form>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-emerald-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-300 py-16 text-gray-500">
          <CalendarDays size={28} />
          <p className="text-sm">No leave requests yet.</p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {items.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold capitalize text-gray-900">
                    {r.leave_type.replace("_", " ")}
                  </span>
                  <Badge value={r.status} />
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  {formatDate(r.start_date)} → {formatDate(r.end_date)}{" "}
                  <span className="text-gray-400">({daysBetween(r.start_date, r.end_date)} day(s))</span>
                </p>
                {r.reason && <p className="mt-0.5 text-sm text-gray-500">{r.reason}</p>}
                <p className="mt-0.5 text-xs text-gray-400">
                  Requested {formatDate(r.created_at)}
                  {r.status !== "pending" && r.decided_at && ` · Decided ${formatDate(r.decided_at)}`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}