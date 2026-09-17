"use client";

import { cn, toDateKey } from "@/lib/utils";

export interface CalendarEvent {
  date: string;
  kind: "holiday" | "leave" | "training" | "today";
  label?: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const KIND_STYLES: Record<CalendarEvent["kind"], { cell: string; dot: string }> = {
  holiday: { cell: "bg-purple-50 text-purple-700", dot: "bg-purple-500" },
  leave: { cell: "bg-blue-50 text-blue-700", dot: "bg-blue-500" },
  training: { cell: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  today: { cell: "ring-2 ring-inset ring-indigo-500", dot: "bg-indigo-500" },
};

export default function MonthGrid({
  year,
  month,
  events,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
}) {
  const eventsByDate = new Map<string, CalendarEvent>();
  for (const e of events) {
    const existing = eventsByDate.get(e.date);
    if (!existing || e.kind === "holiday") eventsByDate.set(e.date, e);
  }
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = first.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const todayKey = toDateKey(new Date());

  const cells: (number | null)[] = [
    ...Array.from({ length: startDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const ev = eventsByDate.get(dateKey);
          const weekend = new Date(year, month, day).getDay() === 0 || new Date(year, month, day).getDay() === 6;
          return (
            <div
              key={dateKey}
              className={cn(
                "relative flex min-h-[3rem] flex-col items-center justify-center rounded-lg p-1 text-xs",
                weekend && !ev && "bg-gray-50 text-gray-400",
                ev ? KIND_STYLES[ev.kind].cell : "bg-white text-gray-700"
              )}
            >
              {day}
              {ev && ev.label && (
                <span className="mt-0.5 hidden max-w-full truncate px-1 text-[9px] font-medium sm:block">
                  {ev.label}
                </span>
              )}
              {ev && (
                <span
                  className={cn(
                    "absolute right-1 top-1 h-1.5 w-1.5 rounded-full",
                    KIND_STYLES[ev.kind].dot,
                    todayKey === dateKey && ev.kind !== "today" && "ring-2 ring-indigo-200"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-center text-xs text-gray-400">{monthLabel}</p>
    </div>
  );
}