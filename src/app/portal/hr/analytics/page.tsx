"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BarChart, DonutChart } from "@/components/charts";
import { formatDuration } from "@/lib/utils";
import type { AppUser, AttendanceRecord, LeaveRequest, LeaveType, Qualification } from "@/lib/types";
import { Percent, Users, CalendarCheck2, GraduationCap, Sparkles, ClipboardCheck } from "lucide-react";

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  annual: "Annual",
  sick: "Sick",
  casual: "Casual",
  maternity: "Maternity",
  unpaid: "Unpaid",
  other: "Other",
};

const NOW = new Date();

function Card({ title, children, icon }: { title: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  );
}

export default function HrAnalyticsPage() {
  const [employees, setEmployees] = useState<AppUser[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [pending, setPending] = useState({ registrations: 0, leaves: 0, changes: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const monthStart = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, "0")}-01`;
      const next = new Date(NOW.getFullYear(), NOW.getMonth() + 1, 1);
      const monthEnd = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
      const [emp, att, lv, ql, reg, lvp, pc] = await Promise.all([
        supabase.from("app_users").select("*").eq("status", "verified"),
        supabase.from("attendance").select("*").gte("date", monthStart).lt("date", monthEnd),
        supabase.from("leave_requests").select("*").gte("created_at", `${NOW.getFullYear()}-01-01T00:00:00`).lte("created_at", `${NOW.getFullYear()}-12-31T23:59:59`),
        supabase.from("qualifications").select("*"),
        supabase.from("app_users").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("profile_change_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      setEmployees((emp.data ?? []).filter((e) => e.employee_id !== "HR-0001"));
      setAttendance(att.data ?? []);
      setLeaves(lv.data ?? []);
      setQualifications(ql.data ?? []);
      setPending({
        registrations: reg.count ?? 0,
        leaves: lvp.count ?? 0,
        changes: pc.count ?? 0,
      });
      setLoading(false);
    })();
  }, []);

  const byDepartment = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of employees) {
      const k = e.department ?? "Unassigned";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  }, [employees]);

  const byPosition = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of employees) {
      const k = e.position ?? "Unassigned";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value }));
  }, [employees]);

  const hires = useMemo(() => {
    const months: { label: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(NOW.getFullYear(), NOW.getMonth() - i, 1);
      const count = employees.filter((e) => {
        const c = new Date(e.created_at);
        return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth();
      }).length;
      months.push({
        label: d.toLocaleDateString(undefined, { month: "short" }),
        value: count,
      });
    }
    return months;
  }, [employees]);

  const attendanceStats = useMemo(() => {
    const present = attendance.filter((a) => a.status === "present").length;
    const late = attendance.filter((a) => a.is_late).length;
    const half = attendance.filter((a) => a.status === "half_day").length;
    const leave = attendance.filter((a) => a.status === "leave").length;
    const holiday = attendance.filter((a) => a.status === "holiday").length;
    return [
      { label: "Present", value: present, color: "#10b981" },
      { label: "Late", value: late, color: "#f59e0b" },
      { label: "Half day", value: half, color: "#f97316" },
      { label: "On leave", value: leave, color: "#3b82f6" },
      { label: "Holiday", value: holiday, color: "#8b5cf6" },
    ];
  }, [attendance]);

  const leaveDistribution = useMemo(() => {
    const m = new Map<LeaveType, number>();
    for (const l of leaves) {
      if (l.status !== "approved") continue;
      m.set(l.leave_type, (m.get(l.leave_type) ?? 0) + (l.working_days ?? 1));
    }
    return LEAVE_TYPES().filter((t) => (m.get(t) ?? 0) > 0).map((t) => ({ label: LEAVE_TYPE_LABELS[t], value: m.get(t) ?? 0 }));
  }, [leaves]);

  const totalAttendance = attendance.length;

  const skills = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of employees) {
      for (const s of e.skills ?? []) m.set(s, (m.get(s) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, value]) => ({ label, value }));
  }, [employees]);

  const qualificationDistribution = useMemo(() => {
    const edu = qualifications.filter((q) => q.qualification_type === "educational").length;
    const pro = qualifications.filter((q) => q.qualification_type === "professional").length;
    return [
      { label: "Educational", value: edu, color: "#6366f1" },
      { label: "Professional", value: pro, color: "#14b8a6" },
    ];
  }, [qualifications]);

  const totalWorkMinutes = attendance.reduce((s, a) => s + (a.work_minutes ?? 0), 0);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-gray-500">
          Headcount, attendance and leave statistics for {NOW.toLocaleDateString(undefined, { month: "long", year: "numeric" })}.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Active employees", value: employees.length, icon: Users, to: "/portal/hr/employees" },
          { label: "Pending approvals", value: pending.registrations + pending.leaves + pending.changes, icon: ClipboardCheck, to: "/portal/hr/registrations" },
          { label: "Attendance records", value: totalAttendance, icon: CalendarCheck2, to: "/portal/hr/attendance" },
          { label: "Hours (this month)", value: formatDuration(totalWorkMinutes), icon: Percent, to: "/portal/hr/attendance" },
        ].map((c) => (
          <Link key={c.label} href={c.to} className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-indigo-300 hover:shadow-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <c.icon size={18} />
            </div>
            <p className="mt-4 text-2xl font-bold text-gray-900">{c.value}</p>
            <p className="text-xs text-gray-500">{c.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Employees by department" icon={<Users size={15} className="text-indigo-600" />}>
          <BarChart data={byDepartment} />
        </Card>
        <Card title="Employees by position" icon={<Percent size={15} className="text-fuchsia-600" />}>
          <BarChart data={byPosition} />
        </Card>
        <Card title="New employees over time" icon={<Users size={15} className="text-emerald-600" />}>
          <BarChart data={hires} />
        </Card>
        <Card title="Attendance this month" icon={<CalendarCheck2 size={15} className="text-amber-600" />}>
          <DonutChart data={attendanceStats} />
        </Card>
        <Card title="Approved leave by type" icon={<CalendarCheck2 size={15} className="text-sky-600" />}>
          <BarChart data={leaveDistribution} unit="d" />
        </Card>
        <Card title="Qualification distribution" icon={<GraduationCap size={15} className="text-violet-600" />}>
          <DonutChart data={qualificationDistribution} />
        </Card>
        <Card title="Top skills" icon={<Sparkles size={15} className="text-emerald-600" />}>
          <BarChart data={skills} />
        </Card>
        <Card title="Pending approvals" icon={<ClipboardCheck size={15} className="text-amber-600" />}>
          <BarChart
            data={[
              { label: "Registrations", value: pending.registrations, color: "#f59e0b" },
              { label: "Leave requests", value: pending.leaves, color: "#3b82f6" },
              { label: "Profile changes", value: pending.changes, color: "#8b5cf6" },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

function LEAVE_TYPES(): LeaveType[] {
  return ["annual", "sick", "casual", "maternity", "unpaid", "other"];
}