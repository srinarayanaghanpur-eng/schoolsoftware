import React from "react";
import { View } from "react-native";
import { DSText } from "@/design-system/components";
import { TeacherShell } from "@/features/teacher/shell";

export default function TeacherExamsRoute() {
  return (
    <TeacherShell>
      <View style={{ padding: 20 }}>
        <DSText variant="title" style={{ textAlign: "center" }}>Teacher Exams</DSText>
        <DSText variant="body" style={{ textAlign: "center" }}>
          Timetable view only — create/edit actions are restricted to administrators.
        </DSText>
      </View>
    </TeacherShell>
  );
}
