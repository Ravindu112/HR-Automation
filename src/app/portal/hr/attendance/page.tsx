"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/auth-context";
import Avatar from "@/components/avatar";
import Badge from "@/components/badge";
import Modal from "@/components/modal";
import { logAudit, notify } from "@/lib/activity";
import type {
  AppUser,
  AttendanceRecord,
  AttendanceStatus,
  PublicHoliday,
} from "@/lib/types";
import {
  cn,
  formatDuration,
  formatTime,
  toDateKey,
  workingDaysBetween,
  lateMinutes,
} from "@/lib/utils";
import {
  AlarmClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
} from "lucide-react";

const MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Date(2020, i, 1).toLocaleDateString(undefined, { month: "short" })
);

const STATUS_OPTIONS: AttendanceStatus[] = ["present", "absent", "half_day", "leave", "holiday"];

interface DayRow {
  employee: AppUser;
  record: AttendanceRecord | null;
  isWeekend: boolean;
  isHoliday: PublicHoliday | null;
}

export default function HrAttendancePage() {
  const { user } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [employees, setEmployees] = useState<AppUser[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [loading, setLoading] = useState(true);

  const [dayDate, setDayDate] = useState(toDateKey(now));
  const [dayRows, setDayRows] = useState<DayRow[]>([]);

  const [editing, setEditing] = useState<DayRow | null>(null);
  const [form, setForm] = useState({
    status: "present" as AttendanceStatus,
    clockIn: "",
    clockOut: "",
    reason: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const next = new Date(year, month + 1, 1);
    const monthEnd = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
    const [emp, rec, hol] = await Promise.all([
      supabase
        .from("app_users")
        .select("*")
        .eq("status", "verified")
        .order("created_at", { ascending: false }),
      supabase
        .from("attendance")
        .select("*")
        .gte("date", monthStart)
        .lt("date", monthEnd),
      supabase
        .from("public_holidays")
        .select("*")
        .gte("date", monthStart)
        .lt("date", monthEnd),
    ]);
    setEmployees((emp.data ?? []).filter((e) => e.employee_id !== "HR-0001"));
    setRecords(rec.data ?? []);
    setHolidays(hol.data ?? []);
    setLoading(false);
  }, [year, month, setEmployees, setRecords, setHolidays, setLoading]);

  useEffect(() => {
    load();
  }, [load]);

  const loadDay = useCallback(async (date: string) => {
    const supabase = createClient();
    const { data } = await supabase.from("attendance").select("*").eq("date", date);
    setDayRows((prev) =>
      prev.map((row) => ({
        ...row,
        record: (data ?? []).find((r) => r.user_id === row.employee.id) ?? null,
      }))
    );
  }, []);

  useEffect(() => {
    const d = new Date(`${dayDate}T00:00:00`);
    const dow = d.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const holiday = holidays.find((h) => h.date === dayDate) ?? null;
    setDayRows(
      employees.map((employee) => ({
        employee,
        record: null,
        isWeekend,
        isHoliday: holiday,
      }))
    );
    loadDay(dayDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, dayDate, holidays]);

  if (!user) return null;

  const holidayKeys = holidays.map((h) => h.date);
  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-${new Date(year, month + 1, 0).getDate()}`;
  const workingDaysInMonth = workingDaysBetween(monthStart, monthEnd, holidayKeys);

  const statsFor = (employee: AppUser) => {
    const mine = records.filter((r) => r.user_id === employee.id);
    const present = mine.filter((r) => r.status === "present").length;
    const late = mine.filter((r) => r.is_late).length;
    const half = mine.filter((r) => r.status === "half_day").length;
    const leave = mine.filter((r) => r.status === "leave").length;
    const holiday = mine.filter((r) => r.status === "holiday").length;
    const hours = mine.reduce((s, r) => s + (r.work_minutes ?? 0), 0);
    const recorded = mine.filter((r) => r.status !== "leave" && r.status !== "holiday").length;
    const absent = Math.max(0, workingDaysInMonth - recorded);
    return { present, half, late, leave, holiday, hours, absent };
  };

  const openEdit = (row: DayRow) => {
    setEditing(row);
    setError(null);
    const r = row.record;
    setForm({
      status: r?.status ?? (row.isHoliday ? "holiday" : row.isWeekend ? "leave" : "absent"),
      clockIn: r?.clock_in_at ? new Date(r.clock_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
      clockOut: r?.clock_out_at ? new Date(r.clock_out_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
      reason: r?.correction_reason ?? "",
    });
  };

  const dayToIso = (time: string, day: string): string => {
    if (!time) return "";
    const [h, m] = time.split(":").map(Number);
    const d = new Date(`${day}T00:00:00`);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  const saveCorrection = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const inIso = form.clockIn ? dayToIso(form.clockIn, dayDate) : null;
      const outIso = form.clockOut ? dayToIso(form.clockOut, dayDate) : null;
      const minutes =
        inIso && outIso
          ? Math.round((new Date(outIso).getTime() - new Date(inIso).getTime()) / 60000)
          : editing.record?.work_minutes ?? 0;

      const payload: Partial<AttendanceRecord> = {
        user_id: editing.employee.id,
        date: dayDate,
        clock_in_at: inIso,
        clock_out_at: outIso,
        work_minutes: Math.max(0, minutes),
        is_late: (lateMinutes(inIso) ?? 0) > 0,
        status: form.status,
        status_reason: form.status === "absent" ? form.reason || "Corrected by HR" : null,
        corrected_by: user.employee_id,
        correction_reason: form.reason.trim() || "Corrected by HR",
      };

      if (editing.record) {
        await supabase.from("attendance").update(payload).eq("id", editing.record.id);
      } else {
        await supabase.from("attendance").insert(payload);
      }

      await logAudit({
        user,
        action: "attendance.corrected",
        entityType: "attendance",
        entityId: dayDate,
        summary: `Corrected ${editing.employee.employee_id} attendance on ${dayDate} to ${form.status}`,
        newValue: payload,
      });
      await notify({
        userId: editing.employee.id,
        type: "general",
        title: "Attendance corrected",
        body: `Your attendance for ${dayDate} was updated to ${form.status}.`,
        entityType: "attendance",
        entityId: dayDate,
      });
      setEditing(null);
      await load();
      await loadDay(dayDate);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";

  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-sm text-gray-500">
            Review monthly attendance, correct records and mark absences.
          </p>
        </div>
        <Link
          href="/portal/hr/analytics"
          className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          View analytics →
        </Link>
      </div>

      <div className="mb-5 flex items-center gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-gray-200">
        <button
          onClick={() => {
            if (month === 0) {
              setMonth(11);
              setYear((y) => y - 1);
            } else setMonth((m) => m - 1);
          }}
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="min-w-40 text-center text-sm font-semibold capitalize">
          {MONTHS[month]} {year}
        </span>
        <button
          onClick={() => {
            if (month === 11) {
              setMonth(0);
              setYear((y) => y + 1);
            } else setMonth((m) => m + 1);
          }}
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Employee</th>
                  <th className="px-4 py-3 text-center font-semibold">Present</th>
                  <th className="px-4 py-3 text-center font-semibold">Half</th>
                  <th className="px-4 py-3 text-center font-semibold">Late</th>
                  <th className="px-4 py-3 text-center font-semibold">Absent</th>
                  <th className="px-4 py-3 text-center font-semibold">Leave</th>
                  <th className="px-4 py-3 text-center font-semibold">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {employees.map((e) => {
                  const s = statsFor(e);
                  return (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar firstName={e.first_name} lastName={e.last_name} picturePath={e.profile_picture_path} size="sm" />
                          <div>
                            <p className="font-medium text-gray-900">{e.first_name} {e.last_name}</p>
                            <p className="text-xs text-gray-500">{e.employee_id} · {e.department ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      {[
                        { v: s.present, extra: "" },
                        { v: s.half, extra: "" },
                        { v: s.late, extra: s.late > 0 ? "text-amber-600" : "" },
                        { v: s.absent, extra: s.absent > 0 ? "text-red-600" : "" },
                        { v: s.leave, extra: "" },
                      ].map((c, i) => (
                        <td key={i} className={cn("px-4 py-3 text-center tabular-nums", c.extra)}>
                          {c.v}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-center tabular-nums text-gray-700">
                        {formatDuration(s.hours)}
                      </td>
                    </tr>
                  );
                })}
                {employees.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-400">
                      No verified employees yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Day records */}
          <div className="mt-8">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <AlarmClock className="h-4 w-4 text-indigo-600" /> Daily records
            </h2>
            <input
              type="date"
              value={dayDate}
              onChange={(e) => e.target.value && setDayDate(e.target.value)}
              className="mb-4 w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Employee</th>
                    <th className="px-4 py-3 font-semibold">Clock in</th>
                    <th className="px-4 py-3 font-semibold">Clock out</th>
                    <th className="px-4 py-3 font-semibold">Hours</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dayRows.map((row) => (
                    <tr key={row.employee.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar firstName={row.employee.first_name} lastName={row.employee.last_name} picturePath={row.employee.profile_picture_path} size="sm" />
                          <div>
                            <p className="font-medium text-gray-900">{row.employee.first_name} {row.employee.last_name}</p>
                            <p className="text-xs text-gray-500">{row.employee.employee_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{formatTime(row.record?.clock_in_at)}</td>
                      <td className="px-4 py-3 text-gray-700">{formatTime(row.record?.clock_out_at)}</td>
                      <td className="px-4 py-3 text-gray-700">{formatDuration(row.record?.work_minutes)}</td>
                      <td className="px-4 py-3">
                        {row.isHoliday ? (
                          <Badge value="holiday" />
                        ) : row.isWeekend ? (
                          <span className="text-xs text-gray-400">Weekend</span>
                        ) : row.record ? (
                          <Badge value={row.record.status} />
                        ) : (
                          <span className="text-xs font-medium text-red-500">No record</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openEdit(row)}
                          title={row.record ? "Correct record" : "Add record"}
                          className="flex items-center gap-1 rounded-lg p-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                        >
                          <Pencil size={14} />
                          {row.record ? "Correct" : row.isWeekend || row.isHoliday ? "Edit" : "Mark"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Correct attendance · ${dayDate}` : ""}
        wide
      >
        {editing && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
              <Avatar firstName={editing.employee.first_name} lastName={editing.employee.last_name} picturePath={editing.employee.profile_picture_path} />
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {editing.employee.first_name} {editing.employee.last_name}
                </p>
                <p className="text-xs text-gray-500">{editing.employee.employee_id}</p>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setForm({ ...form, status: s })}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium capitalize",
                      form.status === s
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    {s.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Clock in (HH:MM)</label>
                <input type="time" className={inputCls} value={form.clockIn} onChange={(e) => setForm({ ...form, clockIn: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Clock out (HH:MM)</label>
                <input type="time" className={inputCls} value={form.clockOut} onChange={(e) => setForm({ ...form, clockOut: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Reason (audit trail)</label>
              <textarea
                className={inputCls}
                rows={2}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="e.g. Doctor's note provided"
              />
            </div>

            {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

            <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button
                onClick={() => setEditing(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveCorrection}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check size={15} />}
                Save correction
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}