"use client";

import { useRef, useState } from "react";
import { useAdminSession } from "@/components/AdminSessionContext";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { usePopup } from "@/components/CenterPopup";
import { auth } from "@sri-narayana/shared/firebase/client";
import { Download, Loader2, UploadCloud } from "lucide-react";

type UploadType = "fee-structures" | "transport-routes" | "book-prices" | "students";

const UPLOADERS: {
  type: UploadType;
  title: string;
  description: string;
  columns: string;
  template: string;
  templateName: string;
}[] = [
  {
    type: "fee-structures",
    title: "Fee Structures",
    description: "Class-wise fee heads. Existing class rows for the year are updated.",
    columns: "Class | Head | Amount",
    template: "Class,Head,Amount\n1,Tuition Fee,12000\n1,Transport Fee,6000\n2,Tuition Fee,12500\n",
    templateName: "fee-structures-template.csv"
  },
  {
    type: "transport-routes",
    title: "Bus Routes",
    description: "Routes with stops and fares. Existing routes are updated.",
    columns: "Route | Vehicle (optional) | Stop | Fare",
    template: "Route,Vehicle,Stop,Fare\nGhanpur,,Ghanpur,0\nGhanpur,,Palampet,500\nBuddaram,TS09AB1234,Buddaram,800\n",
    templateName: "transport-routes-template.csv"
  },
  {
    type: "book-prices",
    title: "Book Prices",
    description: "Class-wise book / material prices for the year.",
    columns: "Class | Book | Price",
    template: "Class,Book,Price\n1,Maths Textbook,250\n1,English Workbook,180\nNur,Crayon Set,120\n",
    templateName: "book-prices-template.csv"
  },
  {
    type: "students",
    title: "Students (bulk)",
    description: "Bulk admissions. Duplicates (same name + class) are skipped; admission numbers auto-continue.",
    columns: "Name | Class | Section | Village | Route | Phone",
    template: "Name,Class,Section,Village,Route,Phone\nRavi Kumar,1,A,Ghanpur,Ghanpur,9876543210\n",
    templateName: "students-template.csv"
  }
];

function downloadTemplate(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export default function BulkUploads() {
  const { hasPermission } = useAdminSession();
  const { selectedYear } = useAcademicYears();
  const popup = usePopup();
  const [busy, setBusy] = useState<UploadType | null>(null);
  const [lastResult, setLastResult] = useState<Record<UploadType, string>>({
    "fee-structures": "",
    "transport-routes": "",
    "book-prices": "",
    students: ""
  });
  const fileRefs = useRef<Record<UploadType, HTMLInputElement | null>>({
    "fee-structures": null,
    "transport-routes": null,
    "book-prices": null,
    students: null
  });

  if (!hasPermission("settings.bulk_upload")) return null;

  const runUpload = async (type: UploadType, file: File) => {
    if (type !== "transport-routes" && !selectedYear?.id) {
      popup.error("Select an academic year first.");
      return;
    }
    setBusy(type);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please sign in again.");
      const form = new FormData();
      form.append("file", file);
      form.append("type", type);
      if (selectedYear?.id) form.append("academicYearId", selectedYear.id);
      const response = await fetch("/api/admin/settings/bulk-upload", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: form
      });
      const result = await response.json();
      if (!response.ok || result.ok === false) throw new Error(result.error ?? "Upload failed");
      const line = `${result.created} added · ${result.updated} updated · ${result.skipped} skipped`;
      setLastResult((prev) => ({ ...prev, [type]: line }));
      popup.success(
        "Upload complete",
        `${line}${result.errors?.length ? `\n${result.errors.slice(0, 3).join("\n")}` : ""}`
      );
    } catch (err) {
      popup.error("Upload failed", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card space-y-4 p-4 xl:col-span-2">
      <div>
        <h2 className="font-semibold">Bulk Uploads</h2>
        <p className="text-sm font-medium text-[#7d86a8]">
          Upload Excel (.xlsx) or CSV files{selectedYear ? ` for academic year ${selectedYear.name}` : ""}. Allowed roles: Settings Manager, Principal, Admin, Accountant.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {UPLOADERS.map((u) => (
          <div key={u.type} className="rounded-xl border border-[#e6e9f4] bg-[#fafbff] p-4">
            <h3 className="text-sm font-extrabold text-[#1f2136]">{u.title}</h3>
            <p className="mt-1 text-xs font-medium text-[#5f6888]">{u.description}</p>
            <p className="mt-1 font-mono text-[11px] font-bold text-[#3033a1]">{u.columns}</p>
            <input
              ref={(el) => {
                fileRefs.current[u.type] = el;
              }}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void runUpload(u.type, file);
              }}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary text-xs"
                disabled={busy !== null}
                onClick={() => fileRefs.current[u.type]?.click()}
              >
                {busy === u.type ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                {busy === u.type ? "Uploading…" : "Choose file"}
              </button>
              <button
                type="button"
                className="rounded-lg border border-[#e0e3f0] px-3 py-1.5 text-xs font-bold text-[#5f6888] hover:bg-[#eef0ff]"
                onClick={() => downloadTemplate(u.templateName, u.template)}
              >
                <Download size={13} className="mr-1 inline" /> Template
              </button>
            </div>
            {lastResult[u.type] && (
              <p className="mt-2 text-xs font-bold text-[#0f8d52]">Last upload: {lastResult[u.type]}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
