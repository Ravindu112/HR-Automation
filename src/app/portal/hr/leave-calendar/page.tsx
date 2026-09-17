"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import MonthGrid from "@/components/calendar-month";
import type { LeaveRequest, PublicHoliday } from "@/lib/types";
import { toDateKey } from "@/lib/utils";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

export default function HrLeaveCalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const next = new Date(year, month + 1, 1);
    const monthEnd = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
    const [lv, hol] = await Promise.all([
      supabase
        .from("leave_requests")
        .select("*, applicant:app_users(first_name, last_name)")
        .eq("status", "approved")
        .gte("start_date", monthStart)
        .lte("start_date", `${year}-12-31`),
      supabase
        .from("public_holidays")
        .select("*")
        .gte("date", monthStart)
        .lt("date", monthEnd),
    ]);
    setLeaves(lv.data ?? []);
    setHolidays(hol.data ?? []);
    setLoading(false);
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  const events = [
    ...holidays.map((h) => ({ date: h.date, kind: "holiday" as const, label: h.name })),
    ...leaves.flatMap((r) => {
      const start = new Date(`${r.start_date}T00:00:00`);
      const end = new Date(`${r.end_date}T00:00:00`);
      const list: { date: string; kind: "leave"; label: string }[] = [];
      const cursor = new Date(start);
      while (cursor <= end) {
        const name =
          r.applicant && "first_name" in r.applicant
            ? `${r.applicant.first_name} ${r.applicant.last_name}`.split(" ").map((p) => p[0]).join("")
            : r.is_half_day
              ? "½"
              : "L";
        list.push({ date: toDateKey(cursor), kind: "leave", label: name });
        cursor.setDate(cursor.getDate() + 1);
      }
      return list;
    }),
  ];

  return (
    <div className="mx-auto max-w-4xl p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Leave calendar</h1>
          <p className="text-sm text-gray-500">
            Approved leave across the company plus public holidays.
          </p>
        </div>
        <Link
          href="/portal/hr/leave"
          className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Manage requests →
        </Link>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-center gap-1 rounded-xl bg-white p-1 ring-1 ring-gray-200">
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
          <div className="flex min-w-44 items-center justify-center gap-1 text-sm font-semibold capitalize">
            <CalendarDays className="h-4 w-4 text-indigo-600" />
          </div>
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
            <MonthGrid year={year} month={month} events={events} />
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-purple-500" /> Holiday
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Approved leave (initials)
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}