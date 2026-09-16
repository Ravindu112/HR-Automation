"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import Badge from "@/components/badge";
import type { Qualification } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { GraduationCap, Loader2, Plus, Trash2 } from "lucide-react";

export default function EmployeeQualificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Qualification[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [institution, setInstitution] = useState("");
  const [year, setYear] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("qualifications")
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

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: insertError } = await supabase.from("qualifications").insert({
        user_id: user.id,
        title: title.trim(),
        institution: institution.trim() || null,
        year: year.trim() || null,
        status: "approved",
        decided_at: new Date().toISOString(),
        decided_by: user.employee_id,
      });
      if (insertError) throw insertError;
      setTitle("");
      setInstitution("");
      setYear("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (q: Qualification) => {
    if (!confirm(`Delete qualification "${q.title}"?`)) return;
    const supabase = createClient();
    await supabase.from("qualifications").delete().eq("id", q.id);
    await load();
  };

  const inputCls =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200";

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <h1 className="text-2xl font-bold">My Qualifications</h1>
      <p className="text-sm text-gray-500">
        Add your qualifications — they are added to your profile immediately,
        no review needed.
      </p>

      <form onSubmit={add} className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
        <h3 className="mb-4 font-semibold">Add a new qualification</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Qualification * <span className="text-gray-400">(e.g. BSc Computer Science)</span>
            </label>
            <input
              required
              className={inputCls}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Institution</label>
            <input
              className={inputCls}
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="University name"
            />
          </div>
        </div>
        <div className="mt-4 sm:max-w-[12rem]">
          <label className="mb-1 block text-sm font-medium text-gray-700">Year</label>
          <input
            className={inputCls}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="2024"
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
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus size={15} />}
          {saving ? "Adding…" : "Add qualification"}
        </button>
      </form>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-emerald-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-300 py-16 text-gray-500">
          <GraduationCap size={28} />
          <p className="text-sm">No qualifications added yet.</p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {items.map((q) => (
            <li key={q.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{q.title}</p>
                <p className="text-xs text-gray-500">
                  {q.institution ?? "—"}
                  {q.year && ` · ${q.year}`} · {formatDate(q.created_at)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge value={q.status} />
                <button
                  onClick={() => remove(q)}
                  title="Remove"
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}