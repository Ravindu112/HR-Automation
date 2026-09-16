"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  avatarPath,
  uploadFile,
  deleteFile,
  cvPath,
  documentUrl,
  BUCKET_DOCUMENTS,
} from "@/lib/supabase/storage";
import Avatar from "@/components/avatar";
import Badge from "@/components/badge";
import { formatDate, formatBytes } from "@/lib/utils";
import {
  PROFILE_FIELDS,
  type ProfileChangeRequest,
  type Qualification,
  type QualificationType,
} from "@/lib/types";
import {
  Camera,
  Save,
  Loader2,
  FileText,
  Download,
  RefreshCw,
  Upload,
  GraduationCap,
  Briefcase,
  Sparkles,
  Pencil,
} from "lucide-react";

const MAX_CV_BYTES = 5 * 1024 * 1024;

function QualRow({ q }: { q: Qualification }) {
  return (
    <li className="flex items-center justify-between gap-4 border-b border-gray-100 last:border-0 px-5 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{q.title}</p>
        <p className="text-xs text-gray-500">
          {q.institution ?? "—"}
          {q.year && ` · ${q.year}`}
        </p>
      </div>
      <Badge value={q.status} />
    </li>
  );
}

function QualSection({
  type,
  icon,
  items,
  emptyLabel,
}: {
  type: QualificationType;
  icon: React.ReactNode;
  items: Qualification[];
  emptyLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
        {icon}
        <h3 className="font-semibold">
          {type === "educational"
            ? "Educational qualifications"
            : "Professional qualifications"}
        </h3>
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-500">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-gray-100">{items.map((q) => <QualRow key={q.id} q={q} />)}</ul>
      )}
    </div>
  );
}

export default function EmployeeProfilePage() {
  const { user, refresh } = useAuth();
  const [changes, setChanges] = useState<ProfileChangeRequest[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [savingChange, setSavingChange] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [cvUpdating, setCvUpdating] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);

  const loadChanges = async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("profile_change_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setChanges(data ?? []);
  };

  useEffect(() => {
    if (!user) return;
    loadChanges();
    setQualifications([]);
    setCvUrl(null);
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("qualifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setQualifications(data ?? []);
      if (user.cv_path) {
        setCvUrl(await documentUrl(user.cv_path));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!user) return null;

  const educational = qualifications.filter((q) => q.qualification_type === "educational");
  const professional = qualifications.filter((q) => q.qualification_type === "professional");

  const valueOf = (field: string): string => {
    switch (field) {
      case "first_name":
        return user.first_name;
      case "last_name":
        return user.last_name;
      case "email":
        return user.email ?? "";
      case "phone":
        return user.phone ?? "";
      case "date_of_birth":
        return user.date_of_birth ?? "";
      case "address":
        return user.address ?? "";
      default:
        return "";
    }
  };

  const labelFor = (field: string) =>
    PROFILE_FIELDS.find((f) => f.field === field)?.label ?? field;

  const startEdit = (field: string) => {
    setEditing(field);
    setDraft(valueOf(field));
  };

  const submitChange = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !editing) return;
    setSavingChange(true);
    setUploadError(null);
    try {
      const current = valueOf(editing);
      if (draft === current) {
        setEditing(null);
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.from("profile_change_requests").insert({
        user_id: user.id,
        field: editing,
        field_label: labelFor(editing),
        current_value: current || null,
        new_value: draft,
      });
      if (error) throw error;
      setEditing(null);
      await loadChanges();
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setSavingChange(false);
    }
  };

  const onPickAvatar = async (file: File | undefined) => {
    if (!user || !file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const oldPath = user.profile_picture_path;
      const path = avatarPath(user.id, file.name);
      await uploadFile("hr-avatars", path, file);
      const supabase = createClient();
      const { error } = await supabase
        .from("app_users")
        .update({ profile_picture_path: path })
        .eq("id", user.id);
      if (error) throw error;
      if (oldPath && oldPath !== path) void deleteFile("hr-avatars", oldPath);
      await refresh();
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const onPickCv = async (file: File | undefined) => {
    if (!user || !file) return;
    if (!/^application\/pdf$/i.test(file.type) && !file.name.toLowerCase().endsWith(".pdf")) {
      setCvError("Only PDF files are allowed.");
      return;
    }
    if (file.size > MAX_CV_BYTES) {
      setCvError("The PDF must be 5 MB or smaller.");
      return;
    }
    setCvError(null);
    setCvUpdating(true);
    try {
      const path = cvPath(user.id);
      await uploadFile(BUCKET_DOCUMENTS, path, file);
      const supabase = createClient();
      const { error } = await supabase
        .from("app_users")
        .update({
          cv_path: path,
          cv_file_name: file.name,
          cv_size_bytes: file.size,
          cv_updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (error) throw error;
      if (user.cv_path && user.cv_path !== path) {
        void deleteFile(BUCKET_DOCUMENTS, user.cv_path);
      }
      setCvUrl(await documentUrl(path));
      await refresh();
    } catch (err) {
      setCvError((err as Error).message);
    } finally {
      setCvUpdating(false);
    }
  };

  const openCv = async () => {
    if (!user?.cv_path) return;
    const url = cvUrl ?? (await documentUrl(user.cv_path));
    if (!url) {
      alert("Could not build a download link. Try again.");
      return;
    }
    setCvUrl(url);
    window.open(url, "_blank");
  };

  const inputCls =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";

  return (
    <div className="mx-auto max-w-4xl p-6 lg:p-8">
      <h1 className="text-2xl font-bold">My Profile</h1>
      <p className="text-sm text-gray-500">
        Your profile dashboard — CV, qualifications, skills and personal information.
      </p>

      {/* Header card */}
      <div className="mt-6 flex flex-wrap items-center gap-5 rounded-2xl border border-gray-200 bg-white p-6">
        <div className="relative">
          <Avatar
            firstName={user.first_name}
            lastName={user.last_name}
            picturePath={user.profile_picture_path}
            size="xl"
          />
          <label className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-indigo-600 text-white shadow hover:bg-indigo-700">
            <Camera size={14} />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickAvatar(e.target.files?.[0])}
            />
          </label>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold">
              {user.first_name} {user.last_name}
            </h2>
            <Badge value={user.role} />
          </div>
          <p className="text-sm text-gray-500">
            {user.position ?? "No position"}
            {user.department && ` · ${user.department}`}
          </p>
          <p className="mt-1 text-sm text-gray-400">Employee ID: {user.employee_id}</p>
        </div>
        {uploading && (
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
        )}
      </div>

      {(uploadError || cvError) && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {uploadError ?? cvError}
        </div>
      )}

      {/* CV card */}
      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-indigo-600" />
            <h3 className="font-semibold">CV / Resume</h3>
            <span className="text-xs text-gray-400">PDF only, max 5 MB</span>
          </div>
          {cvUpdating && <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />}
        </div>

        {user.cv_path ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">
                {user.cv_file_name ?? "cv.pdf"}
              </p>
              <p className="text-xs text-gray-500">
                {formatBytes(user.cv_size_bytes)} · updated {formatDate(user.cv_updated_at)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={openCv}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                <Download size={14} /> Download
              </button>
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100">
                <RefreshCw size={14} /> Replace
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => onPickCv(e.target.files?.[0])}
                />
              </label>
            </div>
          </div>
        ) : (
          <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-8 text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600">
            <Upload size={22} />
            <span>Click to upload your CV as a PDF</span>
            <span className="text-xs">You can replace it any time</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => onPickCv(e.target.files?.[0])}
            />
          </label>
        )}
      </div>

      {/* Details */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="font-semibold">Personal information</h3>
          <p className="text-xs text-gray-500">
            Department & position are managed by HR.
          </p>
        </div>
        <dl className="divide-y divide-gray-100">
          {PROFILE_FIELDS.map(({ field, label }) => {
            const value = valueOf(field);
            const pendingDup = changes.some(
              (c) => c.field === field && c.status === "pending"
            );
            return (
              <div key={field} className="flex items-start justify-between gap-4 px-6 py-3.5">
                <div className="min-w-0">
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    {label}
                  </dt>
                  <dd className="mt-0.5 truncate text-sm text-gray-900">
                    {field === "date_of_birth" ? formatDate(value) : value || "—"}
                  </dd>
                  {pendingDup && (
                    <p className="mt-1 text-xs font-medium text-amber-600">
                      A change request for this field is pending HR approval.
                    </p>
                  )}
                </div>

                {editing === field ? (
                  <form onSubmit={submitChange} className="flex w-full items-center gap-2 sm:w-72">
                    <input
                      autoFocus
                      className={inputCls}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={savingChange}
                      className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      <Save size={13} />
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => startEdit(field)}
                    className="shrink-0 rounded-lg text-xs font-medium text-indigo-600 hover:underline"
                  >
                    Request change
                  </button>
                )}
              </div>
            );
          })}
          <div className="flex items-start justify-between px-6 py-3.5">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Department</dt>
              <dd className="mt-0.5 text-sm text-gray-900">{user.department ?? "—"}</dd>
            </div>
            <span className="text-xs text-gray-400">Managed by HR</span>
          </div>
          <div className="flex items-start justify-between px-6 py-3.5">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Position</dt>
              <dd className="mt-0.5 text-sm text-gray-900">{user.position ?? "—"}</dd>
            </div>
            <span className="text-xs text-gray-400">Managed by HR</span>
          </div>
        </dl>
      </div>

      {/* Skills */}
      <div className="mt-6 rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
          <Sparkles className="h-4 w-4 text-emerald-600" />
          <h3 className="font-semibold">Skills</h3>
        </div>
        <div className="px-5 py-4">
          {user.skills.length === 0 ? (
            <p className="text-sm text-gray-500">
              No skills added yet.{" "}
              <Link href="/portal/employee/qualifications" className="text-emerald-600 hover:underline">
                Add skills
              </Link>
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {user.skills.map((s) => (
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
      </div>

      {/* Qualifications */}
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <QualSection
          type="educational"
          icon={<GraduationCap className="h-4 w-4 text-indigo-600" />}
          items={educational}
          emptyLabel="No educational qualifications yet."
        />
        <QualSection
          type="professional"
          icon={<Briefcase className="h-4 w-4 text-indigo-600" />}
          items={professional}
          emptyLabel="No professional qualifications yet."
        />
      </div>

      <Link
        href="/portal/employee/qualifications"
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <Pencil size={14} /> Manage qualifications & skills
      </Link>

      {/* Change request history */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="font-semibold">Profile change requests</h3>
        </div>
        {changes.length === 0 ? (
          <p className="px-6 py-6 text-sm text-gray-500">No change requests yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {changes.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-4 px-6 py-3.5">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {c.field_label}
                  </p>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {c.current_value || "—"} → {c.new_value}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">{formatDate(c.created_at)}</p>
                </div>
                <Badge value={c.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}