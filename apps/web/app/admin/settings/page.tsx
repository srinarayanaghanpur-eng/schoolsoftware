"use client";

import { AdmissionApprovalSettings } from "@/components/AdmissionApprovalSettings";
import { AppLockSettings } from "@/components/AppLockSettings";
import { BackupErasePanel } from "@/components/BackupErasePanel";
import BulkUploads from "@/components/BulkUploads";
import { CampusGpsSettings } from "@/components/CampusGpsSettings";
import { DeclareHolidayModal } from "@/components/DeclareHolidayModal";
import { PageHeader } from "@/components/PageHeader";
import { PaymentUpiSettings } from "@/components/PaymentUpiSettings";
import { TeacherGpsSettings } from "@/components/TeacherGpsSettings";
import { useAdminSession } from "@/components/AdminSessionContext";
import { isRoleAllowedForPath } from "@/lib/routeAccess";
import { DEFAULT_SETTINGS, canAccessModuleFromList, type Module } from "@sri-narayana/shared";
import {
  BellRing,
  CalendarRange,
  ChevronRight,
  CreditCard,
  DatabaseBackup,
  FileText,
  Fingerprint,
  GraduationCap,
  IdCard,
  Layers,
  ReceiptIndianRupee,
  ScanFace,
  ScrollText,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

type SettingsLink = {
  label: string;
  href: string;
  description: string;
  icon: LucideIcon;
  module: Module;
};

type SettingsGroup = {
  title: string;
  eyebrow: string;
  items: SettingsLink[];
};

const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    title: "Access and approvals",
    eyebrow: "Control",
    items: [
      {
        label: "Users and Roles",
        href: "/admin/users",
        description: "Staff accounts, role assignment, and permission switches.",
        icon: UserCog,
        module: "users"
      },
      {
        label: "Approvals",
        href: "/admin/approvals",
        description: "Review pending changes and requests before they apply.",
        icon: ShieldCheck,
        module: "settings"
      },
      {
        label: "Face Attendance",
        href: "/admin/face-attendance",
        description: "Approve shared devices and enroll teacher faces for check-in/check-out.",
        icon: ScanFace,
        module: "settings"
      }
    ]
  },
  {
    title: "System setup",
    eyebrow: "Configuration",
    items: [
      {
        label: "Module Settings",
        href: "/admin/masters/module-toggles",
        description: "Turn optional modules on or off for this school.",
        icon: SlidersHorizontal,
        module: "settings"
      },
      {
        label: "Custom Fields",
        href: "/admin/masters/custom-fields",
        description: "Add extra fields to student and staff forms.",
        icon: Settings2,
        module: "settings"
      },
      {
        label: "Notifications",
        href: "/admin/notifications",
        description: "Approval requests and communication queue.",
        icon: BellRing,
        module: "communication"
      },
      {
        label: "Payment Gateways",
        href: "/admin/masters/payment-gateways",
        description: "UPI, card, and online payment provider setup.",
        icon: CreditCard,
        module: "settings"
      },
      {
        label: "Subscription Plans",
        href: "/admin/masters/subscription-plans",
        description: "Plan limits, billing cycle, and school subscription.",
        icon: ReceiptIndianRupee,
        module: "settings"
      },
      {
        label: "Compliance",
        href: "/admin/masters/compliance-packs",
        description: "Compliance packs and checklist items.",
        icon: ShieldCheck,
        module: "settings"
      },
      {
        label: "Academic Years",
        href: "/admin/settings/academic-years",
        description: "Sessions, terms, and the active academic year.",
        icon: CalendarRange,
        module: "settings"
      }
    ]
  },
  {
    title: "Templates",
    eyebrow: "Documents",
    items: [
      {
        label: "Report Cards",
        href: "/admin/report-cards",
        description: "Report card templates and print layouts.",
        icon: GraduationCap,
        module: "settings"
      },
      {
        label: "Certificates",
        href: "/admin/certificates",
        description: "Certificate templates and issue records.",
        icon: FileText,
        module: "certificates"
      },
      {
        label: "ID Cards",
        href: "/admin/id-cards",
        description: "ID card designs and bulk printing.",
        icon: IdCard,
        module: "students"
      },
      {
        label: "Admission Form",
        href: "/admin/admission-form",
        description: "Admission form fields and student intake flow.",
        icon: Layers,
        module: "students"
      }
    ]
  },
  {
    title: "Data and safety",
    eyebrow: "Protection",
    items: [
      {
        label: "Activity Log",
        href: "/admin/settings/activity-logs",
        description: "See every sign-in and data change across the app.",
        icon: ScrollText,
        module: "settings"
      },
      {
        label: "Backup and Restore",
        href: "/admin/backup",
        description: "Export, restore, and erase school data.",
        icon: DatabaseBackup,
        module: "settings"
      },
      {
        label: "Biometric",
        href: "/admin/biometric",
        description: "Attendance device connection and sync.",
        icon: Fingerprint,
        module: "settings"
      }
    ]
  }
];

export default function SettingsPage() {
  const { role, permissions } = useAdminSession();
  const canViewActivity = role === "super_admin" || role === "settings_manager";
  const isSettingsManager = role === "settings_manager";

  const visibleGroups = useMemo(
    () =>
      SETTINGS_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            canAccessModuleFromList(role, permissions, item.module) && isRoleAllowedForPath(item.href, role)
        )
      })).filter((group) => group.items.length > 0),
    [permissions, role]
  );

  return (
    <>
      <PageHeader
        title={isSettingsManager ? "Settings Manager" : "Settings"}
        description="System setup, access control, templates, approvals, and data safety."
      />
      <section className="space-y-6 p-4 md:p-7">
        {isSettingsManager && (
          <div className="card flex items-start gap-4 p-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#eef0ff] text-[#3033a1]">
              <ShieldCheck size={22} />
            </span>
            <div>
              <h2 className="font-extrabold text-[#1f2136]">Settings Manager workspace</h2>
              <p className="mt-1 text-sm font-medium text-[#7d86a8]">
                You can manage system setup and configuration. Sensitive approvals are routed to Super Admin for review.
              </p>
            </div>
          </div>
        )}

        {visibleGroups.map((group) => (
          <div key={group.title} className="space-y-3">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#9aa4c4]">{group.eyebrow}</p>
              <h2 className="mt-1 text-lg font-extrabold text-[#1f2136]">{group.title}</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="card group flex items-start gap-3 p-4 transition hover:border-[#c9d3f5]"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f4f5fb] text-[#3033a1]">
                      <Icon size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-extrabold text-[#1f2136]">{item.label}</h3>
                      <p className="mt-1 text-xs font-semibold leading-5 text-[#7d86a8]">{item.description}</p>
                    </div>
                    <ChevronRight size={17} className="mt-1 shrink-0 text-[#a4abc5]" />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        <div id="school-configuration" className="space-y-5 border-t border-[#edf0f7] pt-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eef0ff] text-[#3033a1]">
              <Users size={19} />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-[#1f2136]">School configuration</h2>
              <p className="text-sm font-medium text-[#7d86a8]">
                Locations, attendance rules, salary policy, payments, and data safety for this school.
              </p>
            </div>
          </div>

          {canViewActivity && (
            <Link
              href="/admin/settings/activity-logs"
              className="card flex items-center justify-between gap-3 p-4 transition hover:border-[#c9d3f5]"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f1ecff] text-[#6b47b8]">
                  <ScrollText size={20} />
                </span>
                <div>
                  <h2 className="font-semibold">Activity Log</h2>
                  <p className="text-sm font-medium text-[#7d86a8]">
                    See every sign-in and data change across the app — who did it, when, and from which device.
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="shrink-0 text-[#a4abc5]" />
            </Link>
          )}

          <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <h2 className="font-semibold">Management Declared Holiday</h2>
              <p className="text-sm font-medium text-[#7d86a8]">
                Declare a sudden holiday (heavy rain, government order, emergency). Teacher check-in is blocked and payroll excludes the date from working days. Manage or cancel declared holidays on the Holidays page.
              </p>
            </div>
            <DeclareHolidayModal />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <CampusGpsSettings />
            <TeacherGpsSettings />
            <AppLockSettings />
            <div className="card space-y-3 p-4 xl:col-span-2">
              <h2 className="font-semibold">Attendance and salary rules</h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <input className="field" type="time" defaultValue={DEFAULT_SETTINGS.schoolStartTime} />
                <input className="field" defaultValue={DEFAULT_SETTINGS.graceMinutes} />
              </div>
              <p className="rounded-xl bg-[#f6f8ff] px-4 py-3 text-sm font-medium text-[#4d5096]">
                Late rule (automatic): every 3 late check-ins deduct one full day at that staff member&apos;s own daily
                rate — e.g. daily rate ₹400 with 3 lates deducts ₹400. There is no fixed-amount late deduction.
              </p>
            </div>
            <PaymentUpiSettings />
            <AdmissionApprovalSettings />
            <BulkUploads />
          </div>

          <BackupErasePanel />

          <div className="card space-y-1 p-4">
            <h2 className="font-semibold">About this system</h2>
            <p className="text-sm font-medium text-[#7d86a8]">
              Product: NarayanaOS · Institution: Sri Narayana High School
            </p>
            <p className="text-xs font-medium text-[#7d86a8]">© 2026 Sri Narayana High School · Powered by NarayanaOS</p>
          </div>
        </div>
      </section>
    </>
  );
}
