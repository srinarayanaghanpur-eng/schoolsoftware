import type { AttendanceStatus } from "@sri-narayana/shared";
import { StyleSheet, Text } from "react-native";

const colors: Record<AttendanceStatus, { bg: string; fg: string }> = {
  present: { bg: "#e4f7ec", fg: "#148654" },
  late: { bg: "#fff2d7", fg: "#b8710b" },
  cl: { bg: "#fee9ed", fg: "#c9435e" },
  holiday: { bg: "#eeefff", fg: "#3033a1" },
  absent: { bg: "#fee9ed", fg: "#c9435e" },
  not_marked: { bg: "#edf0f7", fg: "#6d7696" }
};

const labels: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Late",
  cl: "CL",
  holiday: "Holiday",
  absent: "Absent",
  not_marked: "Not marked"
};

export function StatusPill({ status }: { status: AttendanceStatus }) {
  return <Text style={[styles.pill, { backgroundColor: colors[status].bg, color: colors[status].fg }]}>{labels[status]}</Text>;
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 11,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3
  }
});
