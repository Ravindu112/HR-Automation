"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn, formatDateTime } from "@/lib/utils";
import type { Notification, NotificationType } from "@/lib/types";

const TYPE_LABEL: Record<NotificationType, string> = {
  general: "General",
  leave: "Leave",
  profile: "Profile",
  registration: "Registration",
  announcement: "Announcement",
  training: "Training",
  document: "Document",
  performance: "Performance",
};

export default function NotificationCenter({ userId }: { userId: string }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    let query = supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (filter === "unread") query = query.is("read_at", null);
    const { data } = await query.limit(100);
    setItems(data ?? []);
    setLoading(false);
  }, [userId, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const readOne = async (id: string) => {
    const supabase = createClient();
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
  };

  const markAll = async () => {
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    await load();
  };

  const unreadCount = items.filter((n) => !n.read_at).length;

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-gray-500">
            System updates about your leave, profile and account.
          </p>
        </div>
        <button
          onClick={markAll}
          disabled={unreadCount === 0}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          <CheckCheck size={14} /> Mark all read
        </button>
      </div>

      <div className="mb-4 flex gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-gray-200">
        {(["all", "unread"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition",
              filter === f ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100"
            )}
          >
            {f === "all" ? "All" : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-300 py-16 text-gray-500">
          <Bell size={28} />
          <p className="text-sm">
            {filter === "unread" ? "No unread notifications." : "No notifications yet."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {items.map((n) => (
            <li
              key={n.id}
              onClick={() => !n.read_at && readOne(n.id)}
              className={cn(
                "flex items-start gap-3 px-5 py-4",
                !n.read_at ? "cursor-pointer bg-indigo-50/40" : "bg-white"
              )}
            >
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100">
                <Check size={14} className="text-gray-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                    {TYPE_LABEL[n.type]}
                  </span>
                </div>
                {n.body && <p className="mt-0.5 text-sm text-gray-600">{n.body}</p>}
                <p className="mt-1 text-xs text-gray-400">{formatDateTime(n.created_at)}</p>
              </div>
              {!n.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}