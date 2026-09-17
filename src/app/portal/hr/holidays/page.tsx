"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/auth-context";
import { logAudit } from "@/lib/activity";
import type { PublicHoliday } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { CalendarOff, ChevronLeft, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";

export default function HrHolidaysPage() {
  const { user } = useAuth();
  const year = new Date().getFullYear();
  const [viewYear, setViewYear] = useState(year);
  const [items, setItems] = useState<PublicHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<"public" | "company">("public");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("public_holidays")
      .select("*")
      .gte("date", `${viewYear}-01-01`)
      .lte("date", `${viewYear}-12-31`)
      .order("date", { ascending: true });
    setItems(data ?? []);
    setLoading(false);
  }, [viewYear]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!date || !name.trim()) {
      setError("Choose a date and give the holiday a name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: insertError } = await supabase
        .from("public_holidays")
        .insert({ date, name: name.trim(), type, created_by: user?.employee_id ?? null });
      if (insertError) throw insertError;
      await logAudit({
        user,
        action: "holiday.created",
        entityType: "public_holidays",
        entityId: date,
        summary: `Added ${type} holiday "${name.trim()}" on ${date}`,
      });
      setName("");
      setDate("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (h: PublicHoliday) => {
    if (!confirm(`Delete holiday "${h.name}"?`)) return;
    const supabase = createClient();
    await supabase.from("public_holidays").delete().eq("id", h.id);
    await logAudit({
      user,
      action: "holiday.deleted",
      entityType: "public_holidays",
      entityId: h.date,
      summary: `Deleted "${h.name}"`,
    });
    await load();
  };

  const inputCls =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";

  return (
    <div className="mx-auto max-w-4xl p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Public & company holidays</h1>
          <p className="text-sm text-gray-500">
            Holidays are excluded from leave working-day calculations and shown on calendars.
          </p>
        </div>
        <Link
          href="/portal/hr/leave-balances"
          className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Leave balances →
        </Link>
      </div>

      <form onSubmit={add} className="rounded-2xl border border-gray-200 bg-white p-6">
        <h3 className="mb-4 font-semibold">Add a holiday</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Date *</label>
            <input type="date" required className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Name *</label>
            <input required className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Eid al-Fitr" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
            <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as "public" | "company")}>
              <option value="public">Public holiday</option>
              <option value="company">Company day</option>
            </select>
          </div>
        </div>
        {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
        <button
          type="submit"
          disabled={saving}
          className="mt-4 flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus size={15} />}
          Add holiday
        </button>
      </form>

      <div className="mt-6 mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Holiday calendar</h2>
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
          <button onClick={() => setViewYear((y) => y - 1)} className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
            <ChevronLeft size={16} />
          </button>
          <span className="w-20 text-center text-sm font-medium">{viewYear}</span>
          <button onClick={() => setViewYear((y) => y + 1)} className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-300 py-14 text-gray-500">
          <CalendarOff size={26} />
          <p className="text-sm">No holidays in {viewYear}.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <ul className="divide-y divide-gray-100">
            {items.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-9 w-9 flex-col items-center justify-center rounded-lg text-gray-900",
                      h.type === "public" ? "bg-purple-100" : "bg-indigo-100"
                    )}
                  >
                    <span className="text-sm font-bold leading-none">{parseInt(h.date.slice(8), 10)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{h.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatDate(h.date)}
                      <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase text-gray-500">
                        {h.type}
                      </span>
                    </p>
                  </div>
                </div>
                <button onClick={() => remove(h)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Delete">
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}