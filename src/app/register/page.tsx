"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { normalizeEmployeeId } from "@/lib/session";
import {
  pendingAvatarPath,
  pendingDocumentPath,
  uploadFile,
} from "@/lib/supabase/storage";
import { DOCUMENT_CATEGORIES, type DocumentCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  SearchCheck,
  UserRound,
  Files,
  CheckCircle2,
  ChevronLeft,
  Upload,
  X,
  Loader2,
} from "lucide-react";

type Step = "verify" | "details" | "docs" | "done";

interface VerifiedId {
  employee_id: string;
  first_name: string;
  last_name: string;
  position: string | null;
  department: string | null;
}

interface DocDraft {
  name: string;
  category: DocumentCategory;
  file: File;
}

const CATEGORY_LABELS = Object.fromEntries(
  DOCUMENT_CATEGORIES.map((c) => [c.value, c.label])
);

export default function RegisterPage() {
  const [step, setStep] = useState<Step>("verify");
  const [idInput, setIdInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verified, setVerified] = useState<VerifiedId | null>(null);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    address: "",
    password: "",
    confirm: "",
  });

  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocDraft[]>([]);
  const [docCategory, setDocCategory] = useState<DocumentCategory>("id");
  const [docName, setDocName] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState("");

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  // ---------- Step 1: verify employee ID ----------
  const verifyId = async (e: FormEvent) => {
    e.preventDefault();
    setVerifyError(null);
    setChecking(true);
    const employeeId = normalizeEmployeeId(idInput);
    try {
      const supabase = createClient();
      const { data: idRecord, error } = await supabase
        .from("employee_ids")
        .select("*")
        .eq("employee_id", employeeId)
        .maybeSingle();

      if (error || !idRecord) {
        setVerifyError(
          "This employee ID is not registered in the system. Ask your HR manager to register your ID first."
        );
        return;
      }
      if (idRecord.status === "claimed") {
        const { data: existing } = await supabase
          .from("app_users")
          .select("status, rejection_reason")
          .eq("employee_id", employeeId)
          .maybeSingle();
        if (existing?.status === "pending") {
          setVerifyError(
            "This employee ID already has a registration awaiting HR verification."
          );
        } else if (existing?.status === "verified") {
          setVerifyError("This employee ID is already registered to an account.");
        } else if (existing?.status === "rejected") {
          setVerifyError(
            `This employee ID was previously rejected${existing.rejection_reason ? ` (${existing.rejection_reason})` : ""}. Contact your HR manager to reissue it.`
          );
        } else {
          setVerifyError("This employee ID is already claimed.");
        }
        return;
      }

      setVerified({
        employee_id: employeeId,
        first_name: idRecord.first_name,
        last_name: idRecord.last_name,
        position: idRecord.position,
        department: idRecord.department,
      });
      setForm((f) => ({
        ...f,
        first_name: f.first_name || idRecord.first_name,
        last_name: f.last_name || idRecord.last_name,
        email: f.email || idRecord.email || "",
      }));
      setStep("details");
    } catch {
      setVerifyError("Could not verify the ID. Try again.");
    } finally {
      setChecking(false);
    }
  };

  // ---------- Step 2: details ----------
  const submitDetails = (e: FormEvent) => {
    e.preventDefault();
    setVerifyError(null);
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setVerifyError("First and last name are required.");
      return;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setVerifyError("Enter a valid email address.");
      return;
    }
    if (form.password.length < 6) {
      setVerifyError("Password must be at least 6 characters.");
      return;
    }
    if (form.password !== form.confirm) {
      setVerifyError("Passwords do not match.");
      return;
    }
    setStep("docs");
  };

  // ---------- Step 3: documents & photo ----------
  const onPickAvatar = (file: File | undefined) => {
    if (!file) return;
    setAvatar(file);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const removeDoc = (idx: number) => setDocs((d) => d.filter((_, i) => i !== idx));

  const finalSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!verified) return;
    setSubmitError(null);
    setSubmitting(true);

    try {
      const employeeId = verified.employee_id;

      let profile_picture_path: string | null = null;
      if (avatar) {
        profile_picture_path = await uploadFile(
          "hr-avatars",
          pendingAvatarPath(employeeId, avatar.name),
          avatar
        );
      }

      const documents: {
        name: string;
        category: string;
        file_name: string;
        file_path: string;
        size_bytes: number;
        mime_type: string;
      }[] = [];
      for (const d of docs) {
        const path = await uploadFile(
          "hr-documents",
          pendingDocumentPath(employeeId, d.file.name),
          d.file
        );
        documents.push({
          name: d.name,
          category: d.category,
          file_name: d.file.name,
          file_path: path,
          size_bytes: d.file.size,
          mime_type: d.file.type || "application/octet-stream",
        });
      }

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: employeeId,
          password: form.password,
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          phone: form.phone,
          date_of_birth: form.date_of_birth,
          address: form.address,
          position: verified.position,
          department: verified.department,
          profile_picture_path,
          documents,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Registration failed.");
      }
      setDoneMessage(data.message);
      setStep("done");
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";
  const labelCls = "mb-1 block text-sm font-medium text-gray-700";

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-10">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white">
            HR
          </div>
          <h1 className="text-xl font-bold text-white">Employee Registration</h1>
        </div>

        {/* Stepper */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {(["verify", "details", "docs", "done"] as Step[]).map((s, i) => {
            const idx = ["verify", "details", "docs", "done"].indexOf(step);
            const active = ["verify", "details", "docs", "done"].indexOf(s) <= idx;
            return (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                    active ? "bg-indigo-600 text-white" : "bg-gray-700 text-gray-400"
                  )}
                >
                  {i + 1}
                </div>
                {i < 3 && (
                  <div className={cn("h-0.5 w-8", active ? "bg-indigo-600" : "bg-gray-700")} />
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl bg-white p-7 shadow-xl">
          {/* ---- STEP: VERIFY ID ---- */}
          {step === "verify" && (
            <div>
              <div className="mb-1 flex items-center gap-2">
                <SearchCheck className="h-5 w-5 text-indigo-600" />
                <h2 className="text-lg font-semibold">Verify your employee ID</h2>
              </div>
              <p className="mb-5 text-sm text-gray-500">
                Enter the employee ID your HR manager handed to you. Only
                pre-registered IDs can create an account.
              </p>
              <form onSubmit={verifyId} className="space-y-4">
                <div>
                  <label className={labelCls}>Employee ID</label>
                  <input
                    required
                    value={idInput}
                    onChange={(e) => setIdInput(e.target.value)}
                    className={cn(inputCls, "uppercase")}
                    placeholder="e.g. EMP1001"
                  />
                </div>
                {verifyError && (
                  <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                    {verifyError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={checking}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {checking && <Loader2 className="h-4 w-4 animate-spin" />}
                  {checking ? "Checking…" : "Verify ID"}
                </button>
              </form>
              <Link
                href="/login"
                className="mt-4 block text-center text-sm text-indigo-600 hover:underline"
              >
                Back to sign in
              </Link>
            </div>
          )}

          {/* ---- STEP: DETAILS ---- */}
          {step === "details" && verified && (
            <form onSubmit={submitDetails} className="space-y-4">
              <div className="mb-1">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <UserRound className="h-5 w-5 text-indigo-600" />
                  Your details
                </h2>
                <p className="mt-1 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                  Employee ID <b>{verified.employee_id}</b> verified — you may
                  fill in your information below. HR will review it before your
                  account is activated.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>First name *</label>
                  <input
                    required
                    className={inputCls}
                    value={form.first_name}
                    onChange={(e) => set("first_name")(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>Last name *</label>
                  <input
                    required
                    className={inputCls}
                    value={form.last_name}
                    onChange={(e) => set("last_name")(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Email</label>
                  <input
                    type="email"
                    className={inputCls}
                    value={form.email}
                    onChange={(e) => set("email")(e.target.value)}
                    placeholder="you@company.com"
                  />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input
                    className={inputCls}
                    value={form.phone}
                    onChange={(e) => set("phone")(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Date of birth</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={form.date_of_birth}
                    onChange={(e) => set("date_of_birth")(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>Department</label>
                  <input className={cn(inputCls, "bg-gray-50")} disabled value={verified.department ?? ""} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Address</label>
                <textarea
                  className={inputCls}
                  rows={2}
                  value={form.address}
                  onChange={(e) => set("address")(e.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Create password *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className={inputCls}
                    value={form.password}
                    onChange={(e) => set("password")(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>Confirm password *</label>
                  <input
                    type="password"
                    required
                    className={inputCls}
                    value={form.confirm}
                    onChange={(e) => set("confirm")(e.target.value)}
                  />
                </div>
              </div>

              {verifyError && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {verifyError}
                </div>
              )}

              <div className="flex justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setStep("verify")}
                  className="flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <ChevronLeft size={15} /> Back
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Continue
                </button>
              </div>
            </form>
          )}

          {/* ---- STEP: DOCUMENTS & PHOTO ---- */}
          {step === "docs" && verified && (
            <form onSubmit={finalSubmit} className="space-y-5">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Files className="h-5 w-5 text-indigo-600" />
                  Documents & profile picture
                </h2>
                <p className="text-sm text-gray-500">
                  Upload supported document scans and a profile photo for HR to
                  verify your identity.
                </p>
              </div>

              {/* Avatar */}
              <div>
                <label className={labelCls}>Profile picture</label>
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gray-100 ring-2 ring-gray-200">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Preview" className="h-full w-full object-cover" />
                    ) : (
                      <UserRound className="h-8 w-8 text-gray-400" />
                    )}
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    <Upload size={15} />
                    {avatar ? "Change photo" : "Upload photo"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => onPickAvatar(e.target.files?.[0])}
                    />
                  </label>
                </div>
              </div>

              {/* Document add form */}
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="mb-3 text-sm font-medium text-gray-700">Add a document</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Category</label>
                    <select
                      className={inputCls}
                      value={docCategory}
                      onChange={(e) => setDocCategory(e.target.value as DocumentCategory)}
                    >
                      {DOCUMENT_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Name (e.g. National ID)</label>
                    <input
                      className={inputCls}
                      value={docName}
                      onChange={(e) => setDocName(e.target.value)}
                      placeholder="National Identity Card"
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <label className="flex-1 cursor-pointer rounded-lg border border-dashed border-gray-300 px-3 py-2 text-center text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600">
                    {docFile ? docFile.name : "Choose a file…"}
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (!docFile) return;
                      setDocs((d) => [
                        ...d,
                        { name: docName.trim() || docFile.name, category: docCategory, file: docFile },
                      ]);
                      setDocFile(null);
                      setDocName("");
                    }}
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Document list */}
              {docs.length > 0 && (
                <ul className="space-y-2">
                  {docs.map((d, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Files className="h-4 w-4 text-indigo-600" />
                        <div>
                          <p className="font-medium text-gray-800">{d.name}</p>
                          <p className="text-xs text-gray-500">
                            {CATEGORY_LABELS[d.category]} · {d.file.name}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDoc(i)}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <X size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {submitError && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {submitError}
                </div>
              )}

              <div className="flex justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setStep("details")}
                  disabled={submitting}
                  className="flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronLeft size={15} /> Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitting ? "Submitting…" : "Submit for HR review"}
                </button>
              </div>
            </form>
          )}

          {/* ---- STEP: DONE ---- */}
          {step === "done" && (
            <div className="py-6 text-center">
              <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" />
              <h2 className="mt-3 text-lg font-semibold">Registration submitted!</h2>
              <p className="mt-2 text-sm text-gray-600">{doneMessage}</p>
              <p className="mt-1 text-sm text-gray-500">
                You will be able to sign in once your account is verified.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-block rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Go to sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}