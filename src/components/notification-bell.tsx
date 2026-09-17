"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime, cn } from "@/lib/utils";
import type { Notification, NotificationType, UserRole } from "@/lib/types";

const TYPE_COLOR: Record<NotificationType, string> = {
  general: "bg-gray-400",
  leave: "bg-blue-500",
  profile: "bg-violet-500",
  registration: "bg-amber-500",
  announcement: "bg-indigo-500",
  training: "bg-emerald-500",
  document: "bg-teal-500",
  performance: "bg-pink-500",
};

export default function NotificationBell({
  userId,
  role,
}: {
  userId: string;
  role: UserRole;
}) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    const [unreadRes, list] = await Promise.all([
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("read_at", null),
      supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);
    setUnread(unreadRes.count ?? 0);
    setItems(list.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const markAll = async () => {
    if (unread === 0) return;
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    await load();
  };

  const allLink = role === "hr_manager" ? "/portal/hr/notifications" : "/portal/employee/notifications";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          setOpen(true);
          load();
        }}
        className="relative rounded-lg p-2 text-gray-300 transition hover:bg-white/10 hover:text-white"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-gray-900">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white text-gray-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            <button
              onClick={markAll}
              className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
            >
              <Check size={12} /> Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : items.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No notifications.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {items.map((n) => (
                  <li key={n.id} className={cn("px-4 py-3", !n.read_at && "bg-indigo-50/50")}>
                    <div className="flex items-start gap-2">
                      <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", TYPE_COLOR[n.type])} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{n.title}</p>
                        {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{n.body}</p>}
                        <p className="mt-1 text-[10px] text-gray-400">{formatDateTime(n.created_at)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-gray-100 px-4 py-2.5 text-right">
            <Link href={allLink} onClick={() => setOpen(false)} className="text-xs font-medium text-indigo-600 hover:underline">
              View all →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}