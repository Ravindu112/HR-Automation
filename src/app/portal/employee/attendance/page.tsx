"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import Badge from "@/components/badge";
import { logAudit } from "@/lib/activity";
import type { AttendanceRecord } from "@/lib/types";
import {
  cn,
  formatDuration,
  formatTime,
  lateMinutes,
  minutesBetween,
  toDateKey,
} from "@/lib/utils";
import {
  AlarmClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  LogIn,
  LogOut,
} from "lucide-react";

const MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Date(2020, i, 1).toLocaleDateString(undefined, { month: "short" })
);

export default function EmployeeAttendancePage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [today, setToday] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(new Date());
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const monthStart = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-01`;
    const nextMonth = new Date(viewYear, viewMonth + 1, 1);
    const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", monthStart)
      .lt("date", monthEnd)
      .order("date", { ascending: true });
    setRecords(data ?? []);
    const { data: todayRow } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", toDateKey(new Date()))
      .maybeSingle();
    setToday(todayRow ?? null);
    setLoading(false);
  }, [user, viewYear, viewMonth]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user) return null;

  const todayKey = toDateKey(new Date());

  const clockIn = async () => {
    setActing(true);
    setError(null);
    try {
      const supabase = createClient();
      const nowIso = new Date().toISOString();
      const late = lateMinutes(nowIso) ?? 0;
      const { error: insertError } = await supabase.from("attendance").insert({
        user_id: user.id,
        date: todayKey,
        clock_in_at: nowIso,
        is_late: late > 0,
        status: late > 0 ? "late" : "present",
      });
      if (insertError) throw insertError;
      await logAudit({
        user,
        action: "attendance.clock_in",
        entityType: "attendance",
        entityId: todayKey,
        summary: `Clocked in at ${formatTime(nowIso)}`,
      });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActing(false);
    }
  };

  const clockOut = async () => {
    if (!today) return;
    setActing(true);
    setError(null);
    try {
      const nowIso = new Date().toISOString();
      const supabase = createClient();
      const work = minutesBetween(today.clock_in_at!, nowIso);
      const { error } = await supabase
        .from("attendance")
        .update({ clock_out_at: nowIso, work_minutes: work })
        .eq("id", today.id);
      if (error) throw error;
      await logAudit({
        user,
        action: "attendance.clock_out",
        entityType: "attendance",
        entityId: todayKey,
        summary: `Clocked out at ${formatTime(nowIso)} after ${formatDuration(work)}`,
      });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActing(false);
    }
  };

  const workedMinutes = records.reduce((s, r) => s + (r.work_minutes ?? 0), 0);
  const presentDays = records.filter((r) => r.status === "present" || r.status === "half_day").length;
  const lateDays = records.filter((r) => r.is_late).length;

  const stats = [
    { label: "Days present", value: presentDays },
    { label: "Total hours", value: formatDuration(workedMinutes) },
    { label: "Late arrivals", value: lateDays },
    { label: "Leave / holiday", value: records.filter((r) => r.status === "leave" || r.status === "holiday").length },
  ];

  const shiftLate = (lateMinutes(today?.clock_in_at) ?? 0) > 0;

  return (
    <div className="mx-auto max-w-4xl p-6 lg:p-8">
      <h1 className="text-2xl font-bold">My Attendance</h1>
      <p className="text-sm text-gray-500">
        Clock in and out each work day and review your attendance history.
      </p>

      {/* Today card */}
      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Today · {clock.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">
              {clock.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {today ? (
              <>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500">
                    In <b className="text-gray-900">{formatTime(today.clock_in_at)}</b>
                  </span>
                  {today.clock_out_at && (
                    <span className="text-gray-500">
                      Out <b className="text-gray-900">{formatTime(today.clock_out_at)}</b>
                    </span>
                  )}
                  {today.clock_out_at && (
                    <span className="text-gray-500">
                      Worked <b className="text-gray-900">{formatDuration(today.work_minutes)}</b>
                    </span>
                  )}
                </div>
                <Badge value={today.status} />
                {today.is_late && (
                  <p className="flex items-center gap-1 text-xs text-amber-600">
                    <AlarmClock size={12} /> Arrived late
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400">No clock-in yet today.</p>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {!today && (
            <button
              onClick={clockIn}
              disabled={acting}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn size={15} />}
              Clock in
            </button>
          )}
          {today && !today.clock_out_at && (
            <button
              onClick={clockOut}
              disabled={acting}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut size={15} />}
              Clock out
            </button>
          )}
          {today?.clock_out_at && (
            <p className="text-xs text-gray-400">
              Shift complete{shiftLate ? " · arrived late" : ""}.
            </p>
          )}
        </div>
      </div>

      {/* Month history */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Attendance history</h2>
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
            <button
              onClick={() => {
                if (viewMonth === 0) {
                  setViewMonth(11);
                  setViewYear((y) => y - 1);
                } else setViewMonth((m) => m - 1);
              }}
              className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="w-28 text-center text-sm font-medium capitalize">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              onClick={() => {
                if (viewMonth === 11) {
                  setViewMonth(0);
                  setViewYear((y) => y + 1);
                } else setViewMonth((m) => m + 1);
              }}
              className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-emerald-600" />
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-300 py-14 text-gray-500">
            <Clock size={26} />
            <p className="text-sm">No attendance records for this month.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <ul className="divide-y divide-gray-100">
              {records.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-9 w-9 flex-col items-center justify-center rounded-lg text-gray-900",
                        r.status === "holiday" || r.status === "leave"
                          ? "bg-gray-100"
                          : r.is_late
                            ? "bg-amber-100"
                            : "bg-emerald-100"
                      )}
                    >
                      <span className="text-sm font-bold leading-none">{parseInt(r.date.slice(8), 10)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(`${r.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatTime(r.clock_in_at)} → {formatTime(r.clock_out_at)} · {formatDuration(r.work_minutes)}
                        {r.corrected_by && <span className="text-amber-600"> · corrected</span>}
                      </p>
                    </div>
                  </div>
                  <Badge value={r.status} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}