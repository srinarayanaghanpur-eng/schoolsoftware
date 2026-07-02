"use client";

import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { PageHeader } from "@/components/PageHeader";
import { usePortalChild } from "@/components/PortalChildContext";
import { adminApiRequest } from "@/lib/adminApiClient";
import { ROLES } from "@sri-narayana/shared";
import { BellRing, Megaphone, School, CalendarDays, BookOpenCheck, AlertTriangle, DollarSign, Circle } from "lucide-react";
import { useEffect, useState } from "react";

const CATEGORIES = [
  { value: "all", label: "All", icon: BellRing },
  { value: "school", label: "School", icon: School },
  { value: "branch", label: "Branch", icon: School },
  { value: "class", label: "Class", icon: Megaphone },
  { value: "holiday", label: "Holiday", icon: CalendarDays },
  { value: "exam", label: "Exam", icon: BookOpenCheck },
  { value: "event", label: "Event", icon: CalendarDays },
  { value: "fee", label: "Fee", icon: DollarSign },
  { value: "emergency", label: "Emergency", icon: AlertTriangle },
];

const CATEGORY_COLORS: Record<string, string> = {
  school: "bg-[#eef0ff] text-[#3033a1]",
  branch: "bg-[#e6f8ef] text-[#0f8d52]",
  class: "bg-[#fff4df] text-[#b87d0e]",
  holiday: "bg-[#f0f2f8] text-[#7d86a8]",
  exam: "bg-[#ffebed] text-[#c83f4d]",
  event: "bg-[#eef0ff] text-[#3033a1]",
  fee: "bg-[#e6f8ef] text-[#0f8d52]",
  emergency: "bg-[#ffebed] text-[#c83f4d]",
};

type Notice = {
  id: string;
  title: string;
  body: string;
  category: string;
  createdAt: string;
};

function Notices() {
  const { selectedChildId, selectedChild, children, switchChild, loading: childrenLoading } = usePortalChild();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("all");

  const loadNotices = async (studentId: string) => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ studentId });
      if (category !== "all") params.set("category", category);
      const result = await adminApiRequest<{ ok: true; notices: Notice[] }>(`/api/portal/notices?${params.toString()}`);
      setNotices(result.notices);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load notices.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedChildId) void loadNotices(selectedChildId);
  }, [selectedChildId, category]);

  if (childrenLoading) {
    return <section className="p-4 md:p-7"><div className="card p-8 text-center text-sm font-semibold text-[#7d86a8]">Loading...</div></section>;
  }

  return (
    <>
      <PageHeader
        title="Notices & Circulars"
        description={selectedChild ? `${selectedChild.name} · Class ${selectedChild.className}` : "School communications"}
        action={
          children.length > 1 ? (
            <select className="field min-w-[220px]" value={selectedChildId} onChange={(e) => switchChild(e.target.value)}>
              {children.map((s) => <option key={s.id} value={s.id}>{s.name} · Class {s.className}</option>)}
            </select>
          ) : null
        }
      />
      <section className="space-y-5 p-4 md:p-7">
        {error && <div className="rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{error}</div>}

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.filter(Boolean).map((cat) => {
            const active = category === cat.value;
            const Icon = cat.icon ?? Circle;
            return (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                  active ? "bg-[#2d3094] text-white shadow-sm" : "bg-white text-[#475067] ring-1 ring-[#e3e6f0] hover:bg-[#f3f4fb]"
                }`}
              >
                <Icon size={14} />
                {cat.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="card p-8 text-center text-sm font-semibold text-[#7d86a8]">Loading notices...</div>
        ) : notices.length > 0 ? (
          <div className="stagger-children space-y-4">
            {notices.map((notice) => (
              <div key={notice.id} className="card p-5">
                <div className="mb-2 flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${CATEGORY_COLORS[notice.category] || "bg-[#f0f2f8] text-[#7d86a8]"}`}>
                    {notice.category}
                  </span>
                  {notice.createdAt && <span className="text-[11px] font-medium text-[#7d86a8]">{notice.createdAt}</span>}
                </div>
                <h3 className="font-extrabold text-[#1b1d32]">{notice.title}</h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-[#303247] whitespace-pre-line">{notice.body}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="card p-8 text-center text-sm font-semibold text-[#7d86a8]">
            <BellRing className="mx-auto mb-3 text-[#3033a1]" size={32} />
            No notices found.
          </div>
        )}
      </section>
    </>
  );
}

export default function PortalNoticesPage() {
  return (
    <AuthGate roles={ROLES}>
      <AppShell>
        <Notices />
      </AppShell>
    </AuthGate>
  );
}
