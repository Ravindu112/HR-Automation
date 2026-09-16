"use client";

import { useEffect, useState } from "react";
import { documentUrl } from "@/lib/supabase/storage";
import type { Document } from "@/lib/types";
import { formatBytes } from "@/lib/utils";
import { Download, Loader2, FileText } from "lucide-react";

interface DocumentListProps {
  documents: Document[];
}

export default function DocumentList({ documents }: DocumentListProps) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (documents.length === 0) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const d of documents) {
        const url = await documentUrl(d.file_path);
        if (cancelled) return;
        if (url) next[d.id] = url;
      }
      setUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [documents]);

  if (documents.length === 0) {
    return <p className="text-sm text-gray-400">No documents uploaded.</p>;
  }

  return (
    <ul className="space-y-2">
      {documents.map((d) => (
        <li key={d.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-indigo-600" />
            <div className="min-w-0">
              <p className="truncate font-medium text-gray-800">{d.name}</p>
              <p className="truncate text-xs text-gray-500">
                {d.category} · {d.file_name} · {formatBytes(d.size_bytes)}
              </p>
            </div>
          </div>
          <a
            href={urls[d.id] ?? "#"}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => {
              if (!urls[d.id]) {
                e.preventDefault();
                setLoadingId(d.id);
                documentUrl(d.file_path).then((u) => {
                  setLoadingId(null);
                  if (u) setUrls((prev) => ({ ...prev, [d.id]: u }));
                });
              }
            }}
            className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
          >
            {loadingId === d.id && !urls[d.id] ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download size={13} />
            )}
            Download
          </a>
        </li>
      ))}
    </ul>
  );
}