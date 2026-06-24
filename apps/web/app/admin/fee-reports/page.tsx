"use client";

import { useState } from "react";
import { BarChart, FileDown } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

interface ReportData {
  type: "class-wise" | "student-wise" | "attendance-fee";
  data: any[];
  loading: boolean;
  error: string;
}

export default function FeeReportsPage() {
  const [activeTab, setActiveTab] = useState<"class-wise" | "student-wise" | "attendance-fee">("class-wise");
  const [reports, setReports] = useState<Record<string, ReportData>>({
    "class-wise": { type: "class-wise", data: [], loading: false, error: "" },
    "student-wise": { type: "student-wise", data: [], loading: false, error: "" },
    "attendance-fee": { type: "attendance-fee", data: [], loading: false, error: "" }
  });

  const generateReport = async (reportType: "class-wise" | "student-wise" | "attendance-fee") => {
    try {
      setReports((prev) => ({
        ...prev,
        [reportType]: { ...prev[reportType], loading: true, error: "" }
      }));

      const response = await fetch(`/api/admin/reports/${reportType}`);
      const data = await response.json();

      if (data.success) {
        setReports((prev) => ({
          ...prev,
          [reportType]: { ...prev[reportType], data: data.data, loading: false }
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
    }
  };

  const report = reports[activeTab];
  const config = reportConfig[activeTab];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fee Reports"
        description="Generate and export fee reports"
      />

      {/* Tabs */}
      <div className="flex gap-2 border-b border-stone-200 overflow-x-auto">
        {Object.entries(reportConfig).map(([type, cfg]) => (
          <button
            key={type}
            onClick={() => setActiveTab(type as any)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === type
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-stone-600 hover:text-stone-900"
            }`}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Active Report */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-stone-900">{config.label}</h3>
            <p className="text-sm text-stone-500">{config.description}</p>
          </div>
          <button
            onClick={() => generateReport(activeTab)}
            disabled={report.loading}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {report.loading ? "Generating..." : "Generate Report"}
          </button>
        </div>

        {report.error && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {report.error}
          </div>
        )}

        {report.data.length > 0 && (
          <>
            {/* Export Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => exportToCSV(report.data, `${activeTab}-report`)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-100 text-emerald-700 font-semibold hover:bg-emerald-200 transition"
              >
                <FileDown size={18} />
                Export CSV
              </button>
            </div>

            {/* Report Table */}
            <div className="rounded-lg bg-white shadow-sm border border-stone-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-stone-50">
                    <tr>
                      {Object.keys(report.data[0] || {}).map((key) => (
                        <th
                          key={key}
                          className="border-b border-stone-200 px-4 py-3 text-left text-sm font-semibold text-stone-900"
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
                      <tr key={idx} className="border-b border-stone-100 hover:bg-stone-50 transition">
                        {Object.values(row).map((value, cidx) => (
                          <td key={cidx} className="px-4 py-3 text-sm text-stone-900">
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

            <p className="text-sm text-stone-500">
              Total Records: {report.data.length}
            </p>
          </>
        )}

        {!report.loading && report.data.length === 0 && !report.error && (
          <div className="text-center py-12 text-stone-500">
            Click "Generate Report" to view data
          </div>
        )}
      </div>
    </div>
  );
}
