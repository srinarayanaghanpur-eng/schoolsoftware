import React from "react";
import { Stack } from "expo-router";
import { TeacherDataProvider } from "@/lib/useTeacherAttendanceData";
import { WorkspaceGuard } from "@/lib/WorkspaceGuard";
import type { Role } from "@sri-narayana/shared";

const ALLOWED: Role[] = ["teacher"];

export default function TeacherLayout() {
  return (
    <WorkspaceGuard allowed={ALLOWED}>
      <TeacherDataProvider>
        <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
      </TeacherDataProvider>
    </WorkspaceGuard>
  );
}
