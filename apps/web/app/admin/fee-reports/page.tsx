"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

type TabType = "class-wise" | "student-wise" | "attendance-fee" | "monthly-collection";

interface ReportData {
  type: TabType;
  data: any[];
  loading: boolean;
  error: string;
}

export default function FeeReportsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("class-wise");
  const [reports, setReports] = useState<Record<string, ReportData>>({
    "class-wise": { type: "class-wise", data: [], loading: false, error: "" },
    "student-wise": { type: "student-wise", data: [], loading: false, error: "" },
    "attendance-fee": { type: "attendance-fee", data: [], loading: false, error: "" },
    "monthly-collection": { type: "monthly-collection", data: [], loading: false, error: "" }
  });

  const generateReport = async (reportType: TabType) => {
    try {
      setReports((prev) => ({
        ...prev,
        [reportType]: { ...prev[reportType], loading: true, error: "" }
      }));

      const response = await fetch(`/api/admin/reports/${reportType}`);
      const data = await response.json();

      if (data.success) {
        const reportData = reportType === "monthly-collection" ? data.months : data.data;
        setReports((prev) => ({
          ...prev,
          [reportType]: { ...prev[reportType], data: reportData, loading: false }
        }));
      } else {
        throw new Error(data.error || "Failed to generate report");
      }
    } catch (error: any) {
      setReports((prev) => ({
        ...prev,
        [reportType]: { ...prev[reportType], loading: false, error: error.message }
      }));
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    const csv = [
      Object.keys(data[0] || {}).join(","),
      ...data.map((row) =>
        Object.values(row)
          .map((v) => (typeof v === "string" && v.includes(",") ? `"${v}"` : v))
          .join(",")
      )
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const reportConfig = {
    "class-wise": {
      label: "Class-Wise Fee Report",
      description: "Fee collection and due summary across classes"
    },
    "student-wise": {
      label: "Student-Wise Fee Report",
      description: "Detailed fee and payment status for each student"
    },
    "attendance-fee": {
      label: "Attendance vs Fee Report",
      description: "Analyze attendance against fee payment status"
    },
    "monthly-collection": {
      label: "Monthly Collection",
      description: "Payment collection totals broken down by month"
    }
  };

  const report = reports[activeTab];
  const config = reportConfig[activeTab];

  return (
    <>
      <PageHeader title="Fee Reports" description="Generate and export fee reports." />

      <section className="space-y-5 p-4 md:p-7">
        <div className="card flex gap-2 overflow-x-auto p-2">
          {Object.entries(reportConfig).map(([type, cfg]) => (
            <button
              key={type}
              onClick={() => setActiveTab(type as any)}
              className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                activeTab === type
                  ? "bg-[#3033a1] text-white shadow-[0_8px_18px_rgba(48,51,161,0.16)]"
                  : "text-[#6f7898] hover:bg-[#f4f5fb] hover:text-[#3033a1]"
              }`}
            >
              {cfg.label}
            </button>
          ))}
        </div>

        <div className="card space-y-4 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
              <h3 className="text-lg font-bold text-[#1f2136]">{config.label}</h3>
              <p className="text-sm font-medium text-[#7d86a8]">{config.description}</p>
          </div>
          <button
            onClick={() => generateReport(activeTab)}
            disabled={report.loading}
              className="btn-primary"
          >
            {report.loading ? "Generating..." : "Generate Report"}
          </button>
        </div>

        {report.error && (
            <div className="rounded-xl border border-[#ffd5da] bg-[#ffebed] p-4 text-sm font-semibold text-[#c83f4d]">
            {report.error}
          </div>
        )}

        {report.data.length > 0 && (
          <>
            {/* Export Buttons */}
              <div className="flex gap-2">
              <button
                onClick={() => exportToCSV(report.data, `${activeTab}-report`)}
                  className="btn-secondary"
              >
                <FileDown size={18} />
                Export CSV
              </button>
            </div>

            {/* Report Table */}
              <div className="overflow-hidden rounded-2xl border border-[#e3e6f0] bg-white">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead className="bg-[#f7f8fd]">
                    <tr>
                      {Object.keys(report.data[0] || {}).map((key) => (
                        <th
                          key={key}
                            className="border-b border-[#edf0f7] px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]"
                        >
                          {key
                            .replace(/([A-Z])/g, " $1")
                            .replace(/^./, (str) => str.toUpperCase())}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.data.map((row, idx) => (
                        <tr key={idx} className="border-b border-[#edf0f7] transition last:border-b-0 hover:bg-[#fafbff]">
                        {Object.values(row).map((value, cidx) => (
                            <td key={cidx} className="px-4 py-3 text-sm font-medium text-[#303247]">
                            {typeof value === "number" && value > 100
                              ? `₹${value.toLocaleString("en-IN")}`
                              : String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

              <p className="text-sm font-semibold text-[#7d86a8]">
              Total Records: {report.data.length}
            </p>
          </>
        )}

        {!report.loading && report.data.length === 0 && !report.error && (
            <div className="rounded-xl bg-[#f7f8fd] py-12 text-center text-sm font-medium text-[#7d86a8]">
            Click "Generate Report" to view data
          </div>
        )}
      </div>
      </section>
    </>
  );
}
