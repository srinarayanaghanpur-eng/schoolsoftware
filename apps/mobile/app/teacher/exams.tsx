import React from "react";
import { TeacherShell } from "@/features/teacher/shell";
import { ExamsScreen } from "@/features/admin/screens";

export default function TeacherExamsRoute() {
  return (
    <TeacherShell>
      <ExamsScreen />
    </TeacherShell>
  );
}
