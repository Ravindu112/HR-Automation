"use client";

import { useEffect, useState } from "react";
import { usePortalGuard } from "@/components/portal-guard";
import PortalShell, { type NavItem } from "@/components/portal-shell";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  IdCard,
  ClipboardCheck,
  Users,
  CalendarDays,
  FilePen,
  AlarmClock,
  BarChart3,
  Wallet,
  CalendarOff,
  ScrollText,
  Bell,
} from "lucide-react";

export default function HrLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = usePortalGuard("hr_manager");
  const [badges, setBadges] = useState({
    registrations: 0,
    leaves: 0,
    profileChanges: 0,
  });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const [reg, lv, pc] = await Promise.all([
        supabase.from("app_users").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("profile_change_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      if (cancelled) return;
      setBadges({
        registrations: reg.count ?? 0,
        leaves: lv.count ?? 0,
        profileChanges: pc.count ?? 0,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600" />
      </div>
    );
  }

  const nav: NavItem[] = [
    { href: "/portal/hr", label: "Dashboard", icon: LayoutDashboard },
    { href: "/portal/hr/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/portal/hr/attendance", label: "Attendance", icon: AlarmClock },
    {
      href: "/portal/hr/registrations",
      label: "Registrations",
      icon: ClipboardCheck,
      badge: badges.registrations,
    },
    { href: "/portal/hr/employees", label: "Employees", icon: Users },
    { href: "/portal/hr/employee-ids", label: "Employee IDs", icon: IdCard },
    {
      href: "/portal/hr/leave",
      label: "Leave requests",
      icon: CalendarDays,
      badge: badges.leaves,
    },
    { href: "/portal/hr/leave-calendar", label: "Leave calendar", icon: CalendarDays },
    { href: "/portal/hr/leave-balances", label: "Leave balances", icon: Wallet },
    { href: "/portal/hr/holidays", label: "Holidays", icon: CalendarOff },
    {
      href: "/portal/hr/profile-changes",
      label: "Profile changes",
      icon: FilePen,
      badge: badges.profileChanges,
    },
    { href: "/portal/hr/audit-logs", label: "Audit logs", icon: ScrollText },
    { href: "/portal/hr/notifications", label: "Notifications", icon: Bell },
  ];

  return (
    <PortalShell
      brand="HR Manager Portal"
      subtitle="Admin view"
      accent="bg-indigo-600"
      nav={nav}
      user={user}
      onSignOut={signOut}
    >
      {children}
    </PortalShell>
  );
}