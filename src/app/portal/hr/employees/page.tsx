"use client";

import { useCallback, useEffect, useDeferredValue, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { documentUrl } from "@/lib/supabase/storage";
import Avatar from "@/components/avatar";
import Badge from "@/components/badge";
import Modal from "@/components/modal";
import DocumentList from "@/components/document-list";
import { useAuth } from "@/context/auth-context";
import { logAudit, notify } from "@/lib/activity";
import type { AppUser, Document, Qualification } from "@/lib/types";
import { formatBytes, formatDate, fullName } from "@/lib/utils";
import {
  Users,
  Search,
  Pencil,
  Loader2,
  FileText,
  Download,
  Sparkles,
  GraduationCap,
  Briefcase,
} from "lucide-react";

export default function HrEmployeesPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AppUser | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [cvLoading, setCvLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ department: "", position: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  const load = useCallback(async () => {
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
    load();
  }, [load]);

  const open = async (emp: AppUser) => {
    setSelected(emp);
    setError(null);
    setEditing(false);
    setCvUrl(null);
    setCvLoading(Boolean(emp.cv_path));
    setForm({ department: emp.department ?? "", position: emp.position ?? "" });
    const supabase = createClient();
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", emp.id)
      .order("created_at", { ascending: false });
    setDocuments(data ?? []);
    const { data: quals } = await supabase
      .from("qualifications")
      .select("*")
      .eq("user_id", emp.id)
      .order("created_at", { ascending: false });
    setQualifications(quals ?? []);
    if (emp.cv_path) {
      setCvUrl(await documentUrl(emp.cv_path));
      setCvLoading(false);
    }
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("app_users")
        .update({ department: form.department.trim() || null, position: form.position.trim() || null })
        .eq("id", selected.id);
      if (updateError) throw updateError;
      await logAudit({
        user,
        action: "employee.department_position_updated",
        entityType: "app_users",
        entityId: selected.id,
        summary: `Updated ${selected.first_name} ${selected.last_name} department/position`,
        oldValue: { department: selected.department, position: selected.position },
        newValue: { department: form.department.trim() || null, position: form.position.trim() || null },
      });
      await notify({
        userId: selected.id,
        type: "profile",
        title: "Your details were updated",
        body: `HR updated your details: ${[(form.department.trim() || selected.department || null) && `department → ${form.department.trim() || "—"}`, (form.position.trim() || selected.position || null) && `position → ${form.position.trim() || "—"}`].filter(Boolean).join(", ")}.`,
        entityType: "app_users",
        entityId: selected.id,
      });
      setEditing(false);
      await load();
      setSelected((s) => (s ? { ...s, department: form.department.trim() || null, position: form.position.trim() || null } : s));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const q = deferredSearch.trim().toLowerCase();
  const filtered = q
    ? employees.filter((e) =>
        [
          e.first_name,
          e.last_name,
          e.email,
          e.position,
          e.department,
          e.employee_id,
          ...(e.skills ?? []),
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      )
    : employees;

  const inputCls =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";

  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Employees</h1>
        <p className="text-sm text-gray-500">
          {employees.length} verified employee{employees.length === 1 ? "" : "s"} in the system
        </p>
      </div>

      <div className="relative mb-5 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, position, department, skill…"
          className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-300 py-16 text-gray-500">
          <Users size={28} />
          <p className="text-sm">{employees.length === 0 ? "No employees yet." : "No employees match your search."}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Employee</th>
                <th className="hidden px-5 py-3 font-semibold md:table-cell">Department</th>
                <th className="px-5 py-3 font-semibold">Position</th>
                <th className="px-5 py-3 font-semibold">Role</th>
                <th className="hidden px-5 py-3 font-semibold sm:table-cell">Joined</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((e) => (
                <tr key={e.id} onClick={() => open(e)} className="cursor-pointer hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar firstName={e.first_name} lastName={e.last_name} picturePath={e.profile_picture_path} size="sm" />
                      <div>
                        <p className="font-medium text-gray-900">{fullName(e.first_name, e.last_name)}</p>
                        <p className="text-xs text-gray-500">{e.employee_id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-5 py-3 text-gray-700 md:table-cell">{e.department ?? "—"}</td>
                  <td className="px-5 py-3 text-gray-700">{e.position ?? "—"}</td>
                  <td className="px-5 py-3">
                    <Badge value={e.role} />
                  </td>
                  <td className="hidden px-5 py-3 text-gray-500 sm:table-cell">{formatDate(e.created_at)}</td>
                  <td className="px-5 py-3 text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600">
                      <Pencil size={13} /> View
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected ? fullName(selected.first_name, selected.last_name) : ""} wide>
        {selected && (
          <div className="space-y-5">
            {editing ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Department</label>
                    <input className={inputCls} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Position</label>
                    <input className={inputCls} value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
                  </div>
                </div>
                {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditing(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Cancel
                  </button>
                  <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar firstName={selected.first_name} lastName={selected.last_name} picturePath={selected.profile_picture_path} size="lg" />
                    <div>
                      <p className="flex items-center gap-2 font-semibold text-gray-900">
                        {fullName(selected.first_name, selected.last_name)}
                        <Badge value={selected.role} />
                      </p>
                      <p className="text-sm text-gray-500">Employee ID: {selected.employee_id}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Pencil size={14} /> Edit dept / position
                  </button>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-gray-50 p-4 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-gray-400">Email</dt>
                    <dd className="break-all font-medium text-gray-900">{selected.email ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-gray-400">Phone</dt>
                    <dd className="font-medium text-gray-900">{selected.phone ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-gray-400">Date of birth</dt>
                    <dd className="font-medium text-gray-900">{formatDate(selected.date_of_birth)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-gray-400">Department</dt>
                    <dd className="font-medium text-gray-900">{selected.department ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-gray-400">Position</dt>
                    <dd className="font-medium text-gray-900">{selected.position ?? "—"}</dd>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <dt className="text-xs uppercase tracking-wide text-gray-400">Address</dt>
                    <dd className="break-all font-medium text-gray-900">{selected.address ?? "—"}</dd>
                  </div>
                </dl>

                <div className="rounded-xl border border-gray-100 p-4">
                  <p className="mb-2 text-sm font-medium text-gray-700">CV / Resume</p>
                  {selected.cv_path ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-indigo-600" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-800">
                            {selected.cv_file_name ?? "cv.pdf"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatBytes(selected.cv_size_bytes)} · {formatDate(selected.cv_updated_at)}
                          </p>
                        </div>
                      </div>
                      {cvLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                      ) : (
                        <a
                          href={cvUrl ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => {
                            if (!cvUrl) {
                              e.preventDefault();
                              setCvLoading(true);
                              documentUrl(selected.cv_path ?? "").then((u) => {
                                setCvLoading(false);
                                if (u) setCvUrl(u);
                              });
                            }
                          }}
                          className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                        >
                          {cvLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download size={13} />
                          )}
                          Download
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No CV uploaded.</p>
                  )}
                </div>

                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                    <Sparkles className="h-4 w-4 text-emerald-600" /> Skills
                  </p>
                  {selected.skills.length === 0 ? (
                    <p className="text-sm text-gray-400">No skills listed.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selected.skills.map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-gray-700">Qualifications</p>
                  {qualifications.length === 0 ? (
                    <p className="text-sm text-gray-400">No qualifications added.</p>
                  ) : (
                    <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                      {qualifications.map((q) => (
                        <li key={q.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                          <div className="flex min-w-0 items-center gap-2">
                            {q.qualification_type === "educational" ? (
                              <GraduationCap className="h-4 w-4 shrink-0 text-indigo-600" />
                            ) : (
                              <Briefcase className="h-4 w-4 shrink-0 text-sky-600" />
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-medium text-gray-800">{q.title}</p>
                              <p className="truncate text-xs text-gray-500">
                                {q.institution ?? "—"}
                                {q.year && ` · ${q.year}`}
                              </p>
                            </div>
                          </div>
                          <Badge value={q.qualification_type} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-gray-700">Documents</p>
                  <DocumentList documents={documents} />
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}