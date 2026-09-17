"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Modal from "@/components/modal";
import type { AuditLog } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";
import { History, Search } from "lucide-react";

export default function HrAuditLogsPage() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setItems(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? items.filter((i) =>
        [
          i.action,
          i.summary,
          i.entity_type,
          i.entity_id,
          i.user_employee_id,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      )
    : items;

  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Audit logs</h1>
        <p className="text-sm text-gray-500">
          A record of important system actions for accountability.
        </p>
      </div>

      <div className="relative mb-5 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search action, entity, employee…"
          className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-300 py-16 text-gray-500">
          <History size={28} />
          <p className="text-sm">No audit logs match your search.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">When</th>
                  <th className="px-4 py-3 font-semibold">Actor</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="hidden px-4 py-3 font-semibold md:table-cell">Entity</th>
                  <th className="px-4 py-3 font-semibold">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelected(log)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="whitespace-nowrap px-5 py-3 text-gray-500">{formatDateTime(log.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-indigo-700">
                        {log.user_employee_id ?? "system"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700">
                        {log.action}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-gray-600 md:table-cell">
                      {log.entity_type ? (
                        <span className="text-xs">
                          <span className="text-gray-400">{log.entity_type}</span>
                          {log.entity_id && <span className="text-gray-500">#{String(log.entity_id).slice(0, 8)}</span>}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="max-w-md truncate px-4 py-3 text-gray-700">{log.summary ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Audit log details">
        {selected && (
          <div className="space-y-4 text-sm">
            <dl className="divide-y divide-gray-100 rounded-xl bg-gray-50 [&>div]:grid [&>div]:grid-cols-[100px_1fr] [&>div]:gap-3 [&>div]:px-3 [&>div]:py-2">
              {[
                ["When", formatDateTime(selected.created_at)],
                ["Actor", selected.user_employee_id ?? "system"],
                ["Action", selected.action],
                ["Entity", selected.entity_type ? `${selected.entity_type}${selected.entity_id ? ` #${selected.entity_id}` : ""}` : "—"],
                ["Summary", selected.summary ?? "—"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{k}</dt>
                  <dd className="break-words text-gray-900">{v}</dd>
                </div>
              ))}
            </dl>

            <JsonBlock title="Old value" value={selected.old_value} />
            <JsonBlock title="New value" value={selected.new_value} />
            <JsonBlock title="Metadata" value={selected.metadata} />

            <div className="flex justify-end border-t border-gray-100 pt-3">
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</p>
      <pre
        className={cn(
          "max-h-48 overflow-auto rounded-xl bg-gray-900 p-3 text-xs text-gray-100"
        )}
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}