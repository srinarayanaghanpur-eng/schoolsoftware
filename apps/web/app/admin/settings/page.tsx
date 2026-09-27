"use client";

import { AdmissionApprovalSettings } from "@/components/AdmissionApprovalSettings";
import { BackupErasePanel } from "@/components/BackupErasePanel";
import BulkUploads from "@/components/BulkUploads";
import { CampusGpsSettings } from "@/components/CampusGpsSettings";
import { DeclareHolidayModal } from "@/components/DeclareHolidayModal";
import { PageHeader } from "@/components/PageHeader";
import { PaymentUpiSettings } from "@/components/PaymentUpiSettings";
import { TeacherGpsSettings } from "@/components/TeacherGpsSettings";
import { DEFAULT_SETTINGS } from "@sri-narayana/shared";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Locations, attendance rules, salary policy, backup, and data safety." />
      <section className="space-y-5 p-4 md:p-7">
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
      </section>
    </>
  );
}
