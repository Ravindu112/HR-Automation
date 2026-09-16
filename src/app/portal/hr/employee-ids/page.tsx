"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import Badge from "@/components/badge";
import Modal from "@/components/modal";
import type { EmployeeId } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { IdCard, Plus, RefreshCw, Copy, Check } from "lucide-react";

export default function EmployeeIIdsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<EmployeeId[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", department: "", position: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextId = (existing: EmployeeId[]): string => {
    let max = 1000;
    for (const e of existing) {
      const m = /^EMP(\d+)$/i.exec(e.employee_id);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return `EMP${max + 1}`;
  };

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("employee_ids")
      .select("*")
      .order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openModal = () => {
    setError(null);
    setPreview(nextId(items));
    setForm({ first_name: "", last_name: "", email: "", department: "", position: "" });
    setOpen(true);
  };

  const createId = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError("First and last name are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: insertError } = await supabase.from("employee_ids").insert({
        employee_id: preview,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim() || null,
        department: form.department.trim() || null,
        position: form.position.trim() || null,
        created_by: user?.employee_id ?? null,
      });
      if (insertError) throw insertError;
      setOpen(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const copy = async (id: string) => {
    await navigator.clipboard.writeText(id);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const inputCls =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";
  const labelCls = "mb-1 block text-sm font-medium text-gray-700";

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Employee IDs</h1>
          <p className="text-sm text-gray-500">
            Pre-register IDs here and hand them to employees so they can create an account.
          </p>
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <Plus size={16} />
          Register employee ID
        </button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-300 py-16 text-gray-500">
          <IdCard size={28} />
          <p className="text-sm">No employee IDs registered yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Employee ID</th>
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="hidden px-5 py-3 font-semibold md:table-cell">Position / Dept</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="hidden px-5 py-3 font-semibold sm:table-cell">Created</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-indigo-700">{e.employee_id}</span>
                      {copied === e.employee_id ? (
                        <Check size={14} className="text-green-600" />
                      ) : (
                        <button
                          onClick={() => copy(e.employee_id)}
                          title="Copy ID"
                          className="rounded p-1 text-gray-400 hover:text-indigo-600"
                        >
                          <Copy size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-700">
                    {e.first_name} {e.last_name}
                  </td>
                  <td className="hidden px-5 py-3 text-gray-600 md:table-cell">
                    {e.position ?? "—"}
                    {e.department && <span className="text-gray-400"> · {e.department}</span>}
                  </td>
                  <td className="px-5 py-3">
                    <Badge value={e.status} />
                  </td>
                  <td className="hidden px-5 py-3 text-gray-500 sm:table-cell">{formatDate(e.created_at)}</td>
                  <td className="px-5 py-3" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Register an employee ID" wide>
        <form onSubmit={createId} className="space-y-4">
          <div className="rounded-xl bg-indigo-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-500">New employee ID</p>
            <div className="mt-1 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPreview(nextId(items))}
                className="flex items-center gap-1 text-lg font-bold text-indigo-700 hover:text-indigo-500"
              >
                {preview}
                <RefreshCw size={12} />
              </button>
              <button
                type="button"
                onClick={() => copy(preview)}
                className="flex items-center gap-1 rounded bg-indigo-600 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                {copied === preview ? <Check size={12} /> : <Copy size={12} />}
                {copied === preview ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-1 text-xs text-indigo-400">
              Give this ID to the employee — they will use it to register.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>First name *</label>
              <input required className={inputCls} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Last name *</label>
              <input required className={inputCls} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Email</label>
            <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Department</label>
              <input className={inputCls} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Position</label>
              <input className={inputCls} value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
            </div>
          </div>

          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {saving ? "Saving…" : "Register ID"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}