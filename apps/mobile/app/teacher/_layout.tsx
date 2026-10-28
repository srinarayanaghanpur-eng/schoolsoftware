import React from "react";
import { ThemedStack } from "@/lib/ThemedStack";
import { TeacherDataProvider } from "@/lib/useTeacherAttendanceData";
import { WorkspaceGuard } from "@/lib/WorkspaceGuard";
import type { Role } from "@sri-narayana/shared";

const ALLOWED: Role[] = ["teacher"];

export default function TeacherLayout() {
  return (
    <WorkspaceGuard allowed={ALLOWED}>
      <TeacherDataProvider>
        <ThemedStack animation="fade" />
      </TeacherDataProvider>
    </WorkspaceGuard>
  );
}
