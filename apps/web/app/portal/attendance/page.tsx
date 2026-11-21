"use client";

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Clock } from "lucide-react";

export default function PortalAttendancePage() {
  return (
    <AppShell>
      <PageHeader title="Attendance" description="Daily attendance for your child" />
      <div className="p-4 md:p-7">
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Clock size={22} />
          </div>
          <h2 className="text-lg font-bold">Attendance tracking is not available yet</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Daily student attendance is not part of the current release. This page will be enabled when the attendance module is added.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
