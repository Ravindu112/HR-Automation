export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fullName(first: string, last: string): string {
  return `${first} ${last}`;
}

export function daysBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24)) + 1;
}

export function fileExtension(fileName: string): string {
  return fileName.split(".").pop() ?? "";
}

/** Default company shift starts at 09:00 local time. */
export const SHIFT_START_HOUR = 9;

export function toDateKey(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatTime(ts: string | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(ts: string | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** minutes → "8h 30m" style */
export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "0h";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Inclusive difference between two instants, in minutes. */
export function minutesBetween(from: string, to: string): number {
  return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
}

const WEEKEND = new Set([0, 6]);

function isWeekend(d: Date): boolean {
  return WEEKEND.has(d.getDay());
}

/** Weekday working days between two inclusive dates (Mon–Fri). */
export function workingDaysBetween(start: string, end: string, holidays?: string[]): number {
  const startD = new Date(`${start}T00:00:00`);
  const endD = new Date(`${end}T00:00:00`);
  const holidaySet = new Set((holidays ?? []).map((h) => toDateKey(h)));
  let count = 0;
  const cursor = new Date(startD);
  while (cursor <= endD) {
    const key = toDateKey(cursor);
    if (!isWeekend(cursor) && !holidaySet.has(key)) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/** Next opening workday after `date` (skips weekends + holidays). */
export function nextWorkday(date: Date, holidays?: string[]): Date {
  const holidaySet = new Set((holidays ?? []).map((h) => toDateKey(h)));
  const cursor = new Date(date);
  cursor.setDate(cursor.getDate() + 1);
  while (isWeekend(cursor) || holidaySet.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() + 1);
  }
  return cursor;
}

/**
 * Late when clock-in is more than 5 minutes after the shift start hour
 * (SHIFT_START_HOUR). Returns null when the timestamp is missing.
 */
export function lateMinutes(clockInAt: string | null | undefined): number | null {
  if (!clockInAt) return null;
  const d = new Date(clockInAt);
  const start = new Date(d);
  start.setHours(SHIFT_START_HOUR, 0, 0, 0);
  const minutes = Math.round((d.getTime() - start.getTime()) / 60000);
  return minutes > 5 ? minutes : 0;
}