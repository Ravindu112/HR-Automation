"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import Badge from "@/components/badge";
import MonthGrid from "@/components/calendar-month";
import { logAudit } from "@/lib/activity";
import {
  LEAVE_TYPES,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveType,
  type PublicHoliday,
} from "@/lib/types";
import {
  daysBetween,
  formatDate,
  toDateKey,
  workingDaysBetween,
} from "@/lib/utils";
import { CalendarDays, Loader2, Send } from "lucide-react";

const YEAR = new Date().getFullYear();

export default function EmployeeLeavePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaveType, setLeaveType] = useState<LeaveType>("annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [halfDay, setHalfDay] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const q = supabase
      .from("leave_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    const [req, bal, hol] = await Promise.all([
      q,
      supabase
        .from("leave_balances")
        .select("*")
        .eq("user_id", user.id)
        .eq("balance_year", YEAR),
      supabase
        .from("public_holidays")
        .select("*")
        .gte("date", `${YEAR}-01-01`)
        .lte("date", `${YEAR}-12-31`),
    ]);
    setItems(req.data ?? []);
    setBalances(bal.data ?? []);
    setHolidays(hol.data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user) return null;

  const holidayKeys = holidays.map((h) => h.date);
  const balanceOf = (type: LeaveType): LeaveBalance | undefined =>
    balances.find((b) => b.leave_type === type);

  const requestedWorkingDays =
    startDate && endDate && !(new Date(endDate) < new Date(startDate))
      ? workingDaysBetween(startDate, endDate, holidayKeys)
      : 0;

  const requestedDays =
    halfDay && startDate === endDate ? 0.5 : requestedWorkingDays;

  const remainingOf = (type: LeaveType): number => {
    const b = balanceOf(type);
    if (!b) return 0;
    return b.allocated - b.used + b.carried_forward;
  };

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
    if (halfDay && startDate !== endDate) {
      setError("Half-day leave applies to a single day.");
      return;
    }
    if (requestedDays <= 0) {
      setError("The selected dates contain no working days (weekends/holidays).");
      return;
    }
    // Simple conflict detection against already approved leave.
    const overlaps = items.filter(
      (r) =>
        r.status === "approved" &&
        !(endDate < r.start_date || startDate > r.end_date)
    );
    if (overlaps.length > 0) {
      setError(
        `This period overlaps an approved ${overlaps[0].leave_type.replace("_", " ")} request (${formatDate(overlaps[0].start_date)} – ${formatDate(overlaps[0].end_date)}).`
      );
      return;
    }
    if (remainingOf(leaveType) < requestedDays) {
      setError(
        `You only have ${remainingOf(leaveType)} day(s) of ${leaveType} leave left this year.`
      );
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
        is_half_day: halfDay,
        working_days: requestedDays,
        balance_year: new Date(startDate).getFullYear(),
      });
      if (insertError) throw insertError;
      await logAudit({
        user,
        action: "leave.requested",
        entityType: "leave_requests",
        summary: `Requested ${requestedDays} day(s) of ${leaveType} leave from ${startDate} to ${endDate}`,
        newValue: { start_date: startDate, end_date: endDate, working_days: requestedDays },
      });
      setStartDate("");
      setEndDate("");
      setHalfDay(false);
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

  const calendarEvents = [
    ...holidays.map((h) => ({ date: h.date, kind: "holiday" as const, label: h.name })),
    ...items
      .filter((r) => r.status === "approved")
      .flatMap((r) => {
        const list: { date: string; kind: "leave"; label: string }[] = [];
        const start = new Date(`${r.start_date}T00:00:00`);
        const end = new Date(`${r.end_date}T00:00:00`);
        const cursor = new Date(start);
        while (cursor <= end) {
          list.push({ date: toDateKey(cursor), kind: "leave", label: r.leave_type });
          cursor.setDate(cursor.getDate() + 1);
        }
        return list;
      }),
  ];

  return (
    <div className="mx-auto max-w-4xl p-6 lg:p-8">
      <h1 className="text-2xl font-bold">My Leave</h1>
      <p className="text-sm text-gray-500">
        Request leave — the HR manager reviews and approves it, then it is
        subtracted from your balance.
      </p>

      {/* Balances */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {LEAVE_TYPES.map((t) => {
          const b = balanceOf(t.value);
          const remaining = remainingOf(t.value);
          return (
            <div key={t.value} className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="truncate text-xs text-gray-500">{t.label}</p>
              {b ? (
                <>
                  <p className="mt-1 text-lg font-bold text-gray-900">
                    {remaining}
                    <span className="text-xs font-normal text-gray-400"> left</span>
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {b.allocated} − {b.used} used{b.carried_forward > 0 ? ` + ${b.carried_forward}` : ""}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-lg font-bold text-gray-300">—</p>
              )}
            </div>
          );
        })}
      </div>

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
                <option key={t.value} value={t.value} disabled={remainingOf(t.value) <= 0}>
                  {t.label}
                  {balanceOf(t.value) ? ` (${remainingOf(t.value)} left)` : ""}
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

        <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={halfDay}
            onChange={(e) => setHalfDay(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-emerald-600"
          />
          Half day (counts 0.5 day)
        </label>

        {requestedDays > 0 && (
          <p className="mt-2 text-xs text-gray-500">
            {requestedDays} working day(s) — weekends and public holidays are excluded.
          </p>
        )}

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

      {/* Leave calendar */}
      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <CalendarDays className="h-4 w-4 text-emerald-600" /> My {YEAR} calendar
        </h3>
        <MonthGrid
          year={YEAR}
          month={new Date().getMonth()}
          events={calendarEvents}
        />
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-purple-500" /> Holiday
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Approved leave
          </span>
        </div>
      </div>

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
                    {r.is_half_day && " (half day)"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  {formatDate(r.start_date)} → {formatDate(r.end_date)}{" "}
                  <span className="text-gray-400">
                    ({r.working_days ?? daysBetween(r.start_date, r.end_date)} day(s))
                  </span>
                </p>
                {r.reason && <p className="mt-0.5 text-sm text-gray-500">{r.reason}</p>}
                <p className="mt-0.5 text-xs text-gray-400">
                  Requested {formatDate(r.created_at)}
                  {r.status !== "pending" && r.decided_at && ` · Decided ${formatDate(r.decided_at)}`}
                </p>
              </div>
              <div className="flex h-full items-center">
                <Badge value={r.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}