"use client";

import Link from "next/link";
import { DeclareHolidayModal } from "@/components/DeclareHolidayModal";
import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { auth } from "@sri-narayana/shared/firebase/client";
import { hasPermission, isHolidayActive, type Holiday } from "@sri-narayana/shared";
import type { LucideIcon } from "lucide-react";
import { BellRing, CalendarOff, ClipboardCheck, FileClock, KeyRound, Megaphone, Send } from "lucide-react";
import { useEffect, useState } from "react";

type Counts = {
  notices: number;
  passwordRequests: number;
  leaveRequests: number;
  attendanceAudits: number;
  managementHolidays: number;
};

type Section = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: string;
  count?: number;
  badge?: string;
};

export default function CommunicationPage() {
  const { role } = useAdminSession();
  const isSuperAdmin = role === "super_admin";
  const [counts, setCounts] = useState<Counts>({ notices: 0, passwordRequests: 0, leaveRequests: 0, attendanceAudits: 0, managementHolidays: 0 });
  const [error, setError] = useState<string | null>(null);

  const apiRequest = async <T,>(path: string): Promise<T> => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Please sign in as admin again.");
    const response = await fetch(path, { headers: { authorization: `Bearer ${token}` } });
    const result = await response.json();
    if (!response.ok || result.ok === false) throw new Error(result.error ?? "Request failed");
    return result;
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [notifications, notices, holidays] = await Promise.all([
          apiRequest<{ passwordRequests: unknown[]; leaveRequests: { status: string }[]; attendanceEditAudits: unknown[] }>("/api/admin/notifications").catch(() => null),
          apiRequest<{ notices: unknown[] }>("/api/admin/notices").catch(() => null),
          apiRequest<{ holidays: Holiday[] }>("/api/admin/holidays").catch(() => null)
        ]);
        setCounts({
          notices: notices?.notices.length ?? 0,
          passwordRequests: (notifications?.passwordRequests as { status: string }[] | undefined)?.filter((r) => r.status === "open").length ?? 0,
          leaveRequests: notifications?.leaveRequests.filter((r) => r.status === "pending").length ?? 0,
          attendanceAudits: notifications?.attendanceEditAudits.length ?? 0,
          managementHolidays: holidays?.holidays.filter((h) => h.type === "management_declared" && isHolidayActive(h)).length ?? 0
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load communication summary");
      }
    };
    void load();
  }, []);

  if (!hasPermission(role, "communication.view")) {
    return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;
  }

  const sections: Section[] = [
    { href: "/admin/notices/circulars", label: "Notices & Circulars", description: "Post announcements and circulars to roles and classes.", icon: Megaphone, tone: "bg-[#fff4df] text-[#c67711]", count: counts.notices },
    { href: "/admin/holidays", label: "Holiday Declaration", description: "Declare or cancel management holidays used by attendance & payroll.", icon: CalendarOff, tone: "bg-[#fff0f2] text-[#d1485c]", count: counts.managementHolidays, badge: "active" },
    { href: "/admin/notifications", label: "Leave Requests", description: "Approve or reject teacher leave requests.", icon: ClipboardCheck, tone: "bg-[#e9f8f0] text-[#0d8f5b]", count: counts.leaveRequests, badge: "pending" },
    { href: "/admin/notifications", label: "Password Reset Requests", description: "Review and resolve staff password reset requests.", icon: KeyRound, tone: "bg-[#edf1ff] text-[#2e38a4]", count: counts.passwordRequests, badge: "open" },
    { href: "/admin/notifications", label: "Attendance Audit", description: "Track manual attendance edits and their audit reasons.", icon: FileClock, tone: "bg-[#eef7f8] text-[#17808a]", count: counts.attendanceAudits, badge: "logged" },
    { href: "/admin/messages", label: "Messages", description: "Direct messages and conversations with staff and parents.", icon: Send, tone: "bg-[#eef6ff] text-[#1967b2]" },
    { href: "/admin/notifications", label: "Notifications", description: "All pending requests and reset history in one place.", icon: BellRing, tone: "bg-[#f4efff] text-[#7445bd]" }
  ];

  return (
    <>
      <PageHeader
        title="Communication"
        description="One hub for notices, holidays, leave, password resets, attendance audits, and messages."
        action={isSuperAdmin ? <DeclareHolidayModal /> : undefined}
      />
      <section className="space-y-5 p-4 md:p-7">
        {error && <div className="rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{error}</div>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <Link
                key={section.label}
                href={section.href}
                className="dashboard-animate group flex items-start gap-4 rounded-2xl border border-[#e3e6f0] bg-white p-5 shadow-[0_2px_4px_rgba(36,42,94,0.03)] transition duration-200 hover:-translate-y-0.5 hover:border-[#c8ccef] hover:shadow-[0_12px_26px_rgba(36,42,94,0.09)]"
              >
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${section.tone}`}>
                  <Icon size={22} strokeWidth={2.1} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-[#1f2136]">{section.label}</h3>
                    {typeof section.count === "number" && section.count > 0 && (
                      <span className="shrink-0 rounded-full bg-[#eef0ff] px-2.5 py-1 text-xs font-bold text-[#3033a1]">
                        {section.count} {section.badge ?? ""}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-medium text-[#7d86a8]">{section.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
