"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Badge from "@/components/badge";
import Avatar from "@/components/avatar";
import { useAuth } from "@/context/auth-context";
import type { AppUser, LeaveRequest, ProfileChangeRequest } from "@/lib/types";
import { daysBetween, formatDate, fullName } from "@/lib/utils";
import {
  Users,
  ClipboardCheck,
  CalendarDays,
  FilePen,
  IdCard,
  ArrowRight,
  Check,
  X,
} from "lucide-react";

interface Counts {
  employees: number;
  ids: number;
  registrations: number;
  leaves: number;
  profileChanges: number;
}

export default function HrDashboardPage() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Counts>({
    employees: 0,
    ids: 0,
    registrations: 0,
    leaves: 0,
    profileChanges: 0,
  });
  const [registrations, setRegistrations] = useState<AppUser[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [changes, setChanges] = useState<ProfileChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const supabase = createClient();
    const [empC, idsC, regC, lvC, pcC, reg, lv, pc] = await Promise.all([
      supabase.from("app_users").select("id", { count: "exact", head: true }).eq("status", "verified"),
      supabase.from("employee_ids").select("id", { count: "exact", head: true }),
      supabase.from("app_users").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("profile_change_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("app_users").select("*").eq("status", "pending").order("created_at", { ascending: false }).limit(5),
      supabase.from("leave_requests").select("*, applicant:app_users(first_name, last_name, department, position, profile_picture_path)").eq("status", "pending").order("created_at", { ascending: false }).limit(5),
      supabase.from("profile_change_requests").select("*, applicant:app_users(first_name, last_name, department, position, profile_picture_path)").eq("status", "pending").order("created_at", { ascending: false }).limit(5),
    ]);
    setCounts({
      employees: empC.count ?? 0,
      ids: idsC.count ?? 0,
      registrations: regC.count ?? 0,
      leaves: lvC.count ?? 0,
      profileChanges: pcC.count ?? 0,
    });
    setRegistrations(reg.data ?? []);
    setLeaves(lv.data ?? []);
    setChanges(pc.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (table: string, id: string, status: "approved" | "rejected") => {
    const supabase = createClient();
    if (table === "profile_change_requests" && status === "approved") {
      const { data: req } = await supabase
        .from("profile_change_requests")
        .select("user_id, field, new_value")
        .eq("id", id)
        .maybeSingle();
      if (req) {
        await supabase
          .from("app_users")
          .update({ [req.field]: req.new_value })
          .eq("id", req.user_id);
      }
    }
    await supabase
      .from(table)
      .update({ status, decided_by: user?.employee_id ?? null, decided_at: new Date().toISOString() })
      .eq("id", id);
    await load();
  };

  const cards = [
    { label: "Verified employees", value: counts.employees, icon: Users, href: "/portal/hr/employees" },
    { label: "Employee IDs issued", value: counts.ids, icon: IdCard, href: "/portal/hr/employee-ids" },
    { label: "Pending registrations", value: counts.registrations, icon: ClipboardCheck, href: "/portal/hr/registrations" },
    { label: "Pending leave", value: counts.leaves, icon: CalendarDays, href: "/portal/hr/leave" },
    { label: "Pending profile changes", value: counts.profileChanges, icon: FilePen, href: "/portal/hr/profile-changes" },
  ];

  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-8">
      <div className="mb-2">
        <h1 className="text-2xl font-bold">HR Dashboard</h1>
        <p className="text-sm text-gray-500">
          Welcome, {user?.first_name}. Here is a summary of everything waiting for a decision.
        </p>
      </div>

      {loading ? (
        <div className="flex h-60 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600" />
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
            {cards.map((c) => (
              <Link
                key={c.label}
                href={c.href}
                className="group rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-indigo-300 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <c.icon size={18} />
                  </div>
                  <ArrowRight size={15} className="text-gray-300 group-hover:text-indigo-500" />
                </div>
                <p className="mt-4 text-2xl font-bold text-gray-900">{c.value}</p>
                <p className="text-xs text-gray-500">{c.label}</p>
              </Link>
            ))}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <PendingPanel
              title="Pending registrations"
              href="/portal/hr/registrations"
              count={counts.registrations}
            >
              {registrations.map((r) => (
                <PanelRow key={r.id} name={fullName(r.first_name, r.last_name)} employeeId={r.employee_id} picturePath={r.profile_picture_path} sub={r.position ?? r.department ?? "—"} time={formatDate(r.created_at)}>
                  <Badge value={r.status} />
                </PanelRow>
              ))}
            </PendingPanel>

            <PendingPanel title="Pending leave requests" href="/portal/hr/leave" count={counts.leaves} actions>
              {leaves.map((r) => (
                <PanelRow
                  key={r.id}
                  name={
                    r.applicant && "first_name" in r.applicant
                      ? fullName(r.applicant.first_name, r.applicant.last_name)
                      : "Unknown"
                  }
                  employeeId=""
                  picturePath={r.applicant?.profile_picture_path}
                  sub={`${r.leave_type.replace("_", " ")} · ${daysBetween(r.start_date, r.end_date)} day(s)`}
                  time={`${formatDate(r.start_date)} → ${formatDate(r.end_date)}`}
                  actions={
                    <RowActions onApprove={() => decide("leave_requests", r.id, "approved")} onReject={() => decide("leave_requests", r.id, "rejected")} />
                  }
                />
              ))}
            </PendingPanel>

            <PendingPanel title="Pending profile changes" href="/portal/hr/profile-changes" count={counts.profileChanges} actions>
              {changes.map((c) => (
                <PanelRow
                  key={c.id}
                  name={
                    c.applicant && "first_name" in c.applicant
                      ? fullName(c.applicant.first_name, c.applicant.last_name)
                      : "Unknown"
                  }
                  employeeId=""
                  picturePath={c.applicant?.profile_picture_path}
                  sub={`${c.field_label} → ${c.new_value}`}
                  time={c.current_value ? `was ${c.current_value}` : "no previous value"}
                  actions={
                    <RowActions onApprove={() => decide("profile_change_requests", c.id, "approved")} onReject={() => decide("profile_change_requests", c.id, "rejected")} />
                  }
                />
              ))}
            </PendingPanel>
          </div>
        </>
      )}
    </div>
  );
}

function PendingPanel({
  title,
  href,
  count,
  actions,
  children,
}: {
  title: string;
  href: string;
  count: number;
  actions?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
        <h3 className="font-semibold">{title}</h3>
        <Link href={href} className="text-xs font-medium text-indigo-600 hover:underline">
          View all ({count})
        </Link>
      </div>
      {count === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-gray-400">Nothing pending.</p>
      ) : (
        <ul className="divide-y divide-gray-100">{children}</ul>
      )}
      {actions && count > 0 && (
        <div className="border-t border-gray-100 px-5 py-2.5 text-right">
          <Link href={href} className="text-xs font-medium text-indigo-600 hover:underline">
            Open management page →
          </Link>
        </div>
      )}
    </div>
  );
}

function PanelRow({
  name,
  employeeId,
  picturePath,
  sub,
  time,
  children,
  actions,
}: {
  name: string;
  employeeId: string;
  picturePath?: string | null;
  sub: string;
  time: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <Avatar firstName={name} lastName="" picturePath={picturePath} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">
          {name}
          {employeeId && <span className="ml-1 text-xs font-normal text-gray-400">{employeeId}</span>}
        </p>
        <p className="truncate text-xs text-gray-500">
          {sub} · <span className="text-gray-400">{time}</span>
        </p>
      </div>
      {children}
      {actions}
    </li>
  );
}

function RowActions({
  onApprove,
  onReject,
}: {
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="flex shrink-0 gap-1">
      <button
        onClick={onApprove}
        title="Approve"
        className="rounded-lg bg-green-50 p-1.5 text-green-600 hover:bg-green-100"
      >
        <Check size={16} />
      </button>
      <button
        onClick={onReject}
        title="Reject"
        className="rounded-lg bg-red-50 p-1.5 text-red-600 hover:bg-red-100"
      >
        <X size={16} />
      </button>
    </div>
  );
}