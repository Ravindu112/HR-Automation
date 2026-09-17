"use client";

import { usePortalGuard } from "@/components/portal-guard";
import PortalShell, { type NavItem } from "@/components/portal-shell";
import { UserRound, Files, GraduationCap, CalendarDays, AlarmClock } from "lucide-react";

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = usePortalGuard("employee");

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600" />
      </div>
    );
  }

  const nav: NavItem[] = [
    { href: "/portal/employee", label: "My Profile", icon: UserRound },
    { href: "/portal/employee/attendance", label: "Attendance", icon: AlarmClock },
    { href: "/portal/employee/documents", label: "My Documents", icon: Files },
    { href: "/portal/employee/qualifications", label: "My Qualifications", icon: GraduationCap },
    { href: "/portal/employee/leave", label: "My Leave", icon: CalendarDays },
  ];

  return (
    <PortalShell
      brand="Employee Portal"
      subtitle="My workspace"
      accent="bg-emerald-600"
      nav={nav}
      user={user}
      onSignOut={signOut}
    >
      {children}
    </PortalShell>
  );
}