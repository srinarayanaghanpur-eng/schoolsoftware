import React from "react";
import { TeacherShell } from "@/features/teacher/shell";

export default function TeacherExamsRoute() {
  return (
    <TeacherShell>
      <View style={{ padding: 20, textAlign: "center" }}>
        <DSText variant="headline">Teacher Exams</DSText>
        <DSText variant="body2">Timetable view only — create/edit actions are restricted to administrators.</DSText>
      </View>
    </TeacherShell>
  );
}
