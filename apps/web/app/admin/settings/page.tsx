import { BackupErasePanel } from "@/components/BackupErasePanel";
import { CampusGpsSettings } from "@/components/CampusGpsSettings";
import { PageHeader } from "@/components/PageHeader";
import { TeacherGpsSettings } from "@/components/TeacherGpsSettings";
import { DEFAULT_SETTINGS } from "@sri-narayana/shared";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Locations, attendance rules, salary policy, backup, and data safety." />
      <section className="space-y-5 p-4 md:p-7">
        <div className="grid gap-4 xl:grid-cols-2">
          <CampusGpsSettings />
          <TeacherGpsSettings />
          <div className="card space-y-3 p-4 xl:col-span-2">
            <h2 className="font-semibold">Attendance and salary rules</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <input className="field" type="time" defaultValue={DEFAULT_SETTINGS.schoolStartTime} />
              <input className="field" defaultValue={DEFAULT_SETTINGS.graceMinutes} />
              <select className="field" defaultValue={DEFAULT_SETTINGS.salaryRules.lateDeductionMode}>
                <option value="none">No deduction</option>
                <option value="half_day">Half-day deduction</option>
                <option value="fixed">Fixed amount per late</option>
                <option value="after_3_lates_one_day">After 3 late days, deduct 1 day</option>
              </select>
              <input className="field" defaultValue={DEFAULT_SETTINGS.salaryRules.fixedLateDeductionAmount} />
            </div>
          </div>
        </div>
        <BackupErasePanel />
      </section>
    </>
  );
}
