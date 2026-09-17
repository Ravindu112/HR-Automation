"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/auth-context";
import Badge from "@/components/badge";
import { logAudit } from "@/lib/activity";
import { LEAVE_TYPES, type AppUser, type LeaveBalance, type LeaveType } from "@/lib/types";
import { cn, fullName } from "@/lib/utils";
import { Loader2, Save, Wallet } from "lucide-react";

const YEAR = new Date().getFullYear();

export default function HrLeaveBalancesPage() {
  const { user } = useAuth();
  const [year, setYear] = useState(YEAR);
  const [employees, setEmployees] = useState<AppUser[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingType, setSavingType] = useState<LeaveType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, { allocated: string; carried: string }>>({});

  const loadEmployees = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("app_users")
      .select("*")
      .eq("status", "verified")
      .order("created_at", { ascending: false });
    setEmployees((data ?? []).filter((e) => e.employee_id !== "HR-0001"));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const loadBalances = useCallback(
    async (employeeId: string) => {
      if (!employeeId) return;
      const supabase = createClient();
      const { data } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("user_id", employeeId)
        .eq("balance_year", year);
      const rows = data ?? [];
      setBalances(rows);
      const next: Record<string, { allocated: string; carried: string }> = {};
      for (const t of LEAVE_TYPES) {
        const b = rows.find((r) => r.leave_type === t.value);
        next[t.value] = {
          allocated: b ? String(b.allocated) : "",
          carried: b ? String(b.carried_forward) : "",
        };
      }
      setInputs(next);
    },
    [year]
  );

  useEffect(() => {
    if (selectedId) loadBalances(selectedId);
  }, [selectedId, loadBalances]);

  const save = async (type: LeaveType) => {
    if (!selectedId) return;
    setSavingType(type);
    setError(null);
    try {
      const supabase = createClient();
      const allocated = parseFloat(inputs[type].allocated) || 0;
      const carried = parseFloat(inputs[type].carried) || 0;
      const existing = balances.find((b) => b.leave_type === type);
      if (existing) {
        await supabase
          .from("leave_balances")
          .update({ allocated, carried_forward: carried, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("leave_balances")
          .insert({ user_id: selectedId, leave_type: type, balance_year: year, allocated, carried_forward: carried });
      }
      await logAudit({
        user,
        action: "leave_balance.updated",
        entityType: "leave_balances",
        entityId: `${selectedId}:${type}:${year}`,
        summary: `Updated ${type} balance for ${year} (allocated ${allocated}, carried ${carried})`,
        newValue: { allocated, carried_forward: carried, leave_type: type, year },
      });
      await loadBalances(selectedId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingType(null);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";

  const selected = employees.find((e) => e.id === selectedId);

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Leave balances</h1>
          <p className="text-sm text-gray-500">
            Allocate annual, sick, casual and other leave per employee. Approved leave is subtracted automatically.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2">
          <input
            type="number"
            min={2000}
            max={2100}
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || YEAR)}
            className="w-20 text-sm outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600" />
        </div>
      ) : (
        <>
          <div className="mb-5">
            <label className="mb-1 block text-sm font-medium text-gray-700">Employee</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className={cn(inputCls, "max-w-md")}
            >
              <option value="">Select an employee…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {fullName(e.first_name, e.last_name)} · {e.employee_id}
                </option>
              ))}
            </select>
          </div>

          {selected ? (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Wallet size={16} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    {selected.first_name} {selected.last_name}
                    <Badge value="employee" className="ml-2" />
                  </p>
                  <p className="text-xs text-gray-500">
                    {selected.employee_id} · {year} leave year
                  </p>
                </div>
              </div>
              {error && <div className="px-5 py-2 text-sm text-red-600">{error}</div>}
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Leave type</th>
                    <th className="px-4 py-3 font-semibold">Allocated</th>
                    <th className="px-4 py-3 font-semibold">Used</th>
                    <th className="px-4 py-3 font-semibold">Carried forward</th>
                    <th className="px-4 py-3 font-semibold">Remaining</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {LEAVE_TYPES.map((t) => {
                    const b = balances.find((x) => x.leave_type === t.value);
                    const remaining = b
                      ? b.allocated - b.used + b.carried_forward
                      : (parseFloat(inputs[t.value]?.allocated) || 0) + (parseFloat(inputs[t.value]?.carried) || 0);
                    return (
                      <tr key={t.value} className="hover:bg-gray-50">
                        <td className="px-5 py-3 capitalize text-gray-900">{t.label}</td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.5"
                            min={0}
                            className={cn(inputCls, "w-20")}
                            value={inputs[t.value]?.allocated ?? ""}
                            onChange={(e) =>
                              setInputs((prev) => ({
                                ...prev,
                                [t.value]: { ...prev[t.value], allocated: e.target.value },
                              }))
                            }
                          />
                        </td>
                        <td className="px-4 py-3 tabular-nums text-gray-700">{b?.used ?? 0}</td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.5"
                            min={0}
                            className={cn(inputCls, "w-20")}
                            value={inputs[t.value]?.carried ?? ""}
                            onChange={(e) =>
                              setInputs((prev) => ({
                                ...prev,
                                [t.value]: { ...prev[t.value], carried: e.target.value },
                              }))
                            }
                          />
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{remaining}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => save(t.value)}
                            disabled={savingType === t.value}
                            className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {savingType === t.value ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save size={13} />}
                            Save
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-300 py-16 text-gray-500">
              <Wallet size={26} />
              <p className="text-sm">Select an employee to manage their leave balances.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}