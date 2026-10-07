import React from "react";
import { Stack } from "expo-router";
import { TeacherDataProvider } from "@/lib/useTeacherAttendanceData";

export default function TeacherLayout() {
  return (
    <TeacherDataProvider>
      <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
    </TeacherDataProvider>
  );
}
