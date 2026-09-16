"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { avatarPath, uploadFile, deleteFile } from "@/lib/supabase/storage";
import Avatar from "@/components/avatar";
import Badge from "@/components/badge";
import { formatDate } from "@/lib/utils";
import { PROFILE_FIELDS, type ProfileChangeRequest } from "@/lib/types";
import { Camera, Save, Loader2 } from "lucide-react";

export default function EmployeeProfilePage() {
  const { user, refresh } = useAuth();
  const [changes, setChanges] = useState<ProfileChangeRequest[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [savingChange, setSavingChange] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
    loadChanges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!user) return null;

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

  const inputCls =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";

  return (
    <div className="mx-auto max-w-4xl p-6 lg:p-8">
      <h1 className="text-2xl font-bold">My Profile</h1>
      <p className="text-sm text-gray-500">
        Your personal information. Important fields can only be changed after HR
        approval.
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

      {uploadError && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {uploadError}
        </div>
      )}

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