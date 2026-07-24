"use client";

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { usePortalChild } from "@/components/PortalChildContext";
import { adminApiRequest } from "@/lib/adminApiClient";
import { Download, FileText, FolderOpen, FileSpreadsheet, FileImage, File as FileIcon } from "lucide-react";
import { useEffect, useState } from "react";

type DownloadItem = {
  id: string;
  title: string;
  description: string;
  fileUrl: string;
  fileSize?: string;
  category: string;
  createdAt: string;
};

function getFileIcon(url: string) {
  const ext = url?.split(".").pop()?.toLowerCase();
  if (["xls", "xlsx", "csv"].includes(ext || "")) return <FileSpreadsheet size={16} />;
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) return <FileImage size={16} />;
  if (["pdf"].includes(ext || "")) return <FileText size={16} />;
  return <FileIcon size={16} />;
}

function formatFileSize(bytes?: string) {
  if (!bytes) return "";
  const num = Number(bytes);
  if (!num) return bytes;
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
}

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "forms", label: "Forms" },
  { value: "circulars", label: "Circulars" },
  { value: "study", label: "Study Material" },
  { value: "results", label: "Results" },
  { value: "general", label: "General" },
];

function DownloadsView() {
  const { selectedChildId, selectedChild, children, switchChild, loading: childrenLoading } = usePortalChild();
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");

  useEffect(() => {
    setLoading(true);
    adminApiRequest<{ ok: true; downloads: DownloadItem[] }>(
      `/api/portal/downloads?${selectedChildId ? `studentId=${encodeURIComponent(selectedChildId)}` : ""}`
    )
      .then((r) => setDownloads(r.downloads))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedChildId]);

  const filtered = category === "all" ? downloads : downloads.filter((d) => d.category === category);
  const categories = [...new Set(downloads.map((d) => d.category))];

  return (
    <>
      <PageHeader title="Downloads" description="Forms, circulars, study materials & resources" />

      <div className="flex flex-wrap gap-2 px-4 md:px-7">
        {CATEGORIES.filter((c) => c.value === "all" || categories.includes(c.value)).map((c) => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            className={`rounded-full px-3.5 py-2 text-sm font-semibold transition ${
              category === c.value
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground ring-1 ring-border hover:bg-muted"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <FolderOpen size={48} className="mb-4 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">No downloads available in this category.</p>
        </div>
      ) : (
        <div className="grid gap-3 p-4 sm:grid-cols-2 md:p-7 lg:grid-cols-3">
          {filtered.map((d) => (
            <a
              key={d.id}
              href={d.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="card group flex flex-col p-4 transition hover:shadow-md"
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {getFileIcon(d.fileUrl)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">{d.title}</p>
                  {d.fileSize && (
                    <p className="text-xs text-muted-foreground">{formatFileSize(d.fileSize)}</p>
                  )}
                </div>
              </div>
              {d.description && (
                <p className="mb-3 text-xs text-muted-foreground line-clamp-2">{d.description}</p>
              )}
              <div className="mt-auto flex items-center justify-between">
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {d.category}
                </span>
                <span className="flex items-center gap-1 text-xs font-semibold text-primary opacity-0 transition group-hover:opacity-100">
                  <Download size={12} /> Download
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </>
  );
}

export default function PortalDownloadsPage() {
  return (
    <AppShell>
      <DownloadsView />
    </AppShell>
  );
}
