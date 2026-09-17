"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { documentPath, documentUrl, uploadFile, deleteFile } from "@/lib/supabase/storage";
import { logAudit } from "@/lib/activity";
import { DOCUMENT_CATEGORIES, type Document, type DocumentCategory } from "@/lib/types";
import { formatBytes, formatDate } from "@/lib/utils";
import { Download, Loader2, Plus, Trash2, Files } from "lucide-react";

export default function EmployeeDocumentsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<DocumentCategory>("certificate");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user) return null;

  const upload = async (e: FormEvent) => {
    e.preventDefault();
    if (!file || !name.trim()) {
      setError("Enter a name and choose a file.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const path = documentPath(user.id, file.name);
      await uploadFile("hr-documents", path, file);
      const supabase = createClient();
      const { error: insertError } = await supabase.from("documents").insert({
        user_id: user.id,
        name: name.trim(),
        category,
        file_name: file.name,
        file_path: path,
        size_bytes: file.size,
        mime_type: file.type || null,
      });
      if (insertError) throw insertError;
      await logAudit({
        user,
        action: "document.uploaded",
        entityType: "documents",
        summary: `Uploaded "${name.trim()}" (${category})`,
        newValue: { name: name.trim(), file_name: file.name, category, size_bytes: file.size },
      });
      setName("");
      setFile(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const remove = async (doc: Document) => {
    if (!confirm(`Delete "${doc.name}"?`)) return;
    const supabase = createClient();
    await deleteFile("hr-documents", doc.file_path);
    await supabase.from("documents").delete().eq("id", doc.id);
    await logAudit({
      user,
      action: "document.deleted",
      entityType: "documents",
      entityId: doc.id,
      summary: `Deleted document "${doc.name}"`,
      oldValue: { name: doc.name, file_name: doc.file_name },
    });
    await load();
  };

  const download = async (doc: Document) => {
    const url = await documentUrl(doc.file_path);
    if (!url) {
      alert("Could not build a download link. Try again.");
      return;
    }
    window.open(url, "_blank");
  };

  const inputCls =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200";

  return (
    <div className="mx-auto max-w-4xl p-6 lg:p-8">
      <h1 className="text-2xl font-bold">My Documents</h1>
      <p className="text-sm text-gray-500">
        Keep your certificates, IDs and contracts up to date. Downloads use
        time-limited secure links.
      </p>

      <form onSubmit={upload} className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
        <h3 className="mb-4 font-semibold">Upload a document</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Name *</label>
            <input
              required
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. BSc Degree Certificate"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
            <select
              className={inputCls}
              value={category}
              onChange={(e) => setCategory(e.target.value as DocumentCategory)}
            >
              {DOCUMENT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="mt-4 block cursor-pointer rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500 hover:border-emerald-400 hover:text-emerald-600">
          {file ? file.name : "Click to choose a file to upload"}
          <input
            type="file"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
        )}

        <button
          type="submit"
          disabled={uploading}
          className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus size={15} />}
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </form>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-emerald-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-300 py-16 text-gray-500">
          <Files size={28} />
          <p className="text-sm">No documents yet.</p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {items.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{d.name}</p>
                <p className="truncate text-xs text-gray-500">
                  {d.file_name} · {d.mime_type ?? "file"} · {formatBytes(d.size_bytes)} ·{" "}
                  {formatDate(d.created_at)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => download(d)}
                  title="Download"
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-emerald-600"
                >
                  <Download size={16} />
                </button>
                <button
                  onClick={() => remove(d)}
                  title="Delete"
                  className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}