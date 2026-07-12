import type { AttendanceStatus } from "@sri-narayana/shared";
import { StyleSheet, Text } from "react-native";

const colors: Record<AttendanceStatus, { bg: string; fg: string }> = {
  present: { bg: "#e4f7ec", fg: "#148654" },
  late: { bg: "#fff2d7", fg: "#b8710b" },
  cl: { bg: "#fee9ed", fg: "#c9435e" },
  holiday: { bg: "#eeefff", fg: "#3033a1" },
  absent: { bg: "#fee9ed", fg: "#c9435e" },
  not_marked: { bg: "#edf0f7", fg: "#6d7696" },
  checked_in: { bg: "#e2f4ea", fg: "#12915d" },
  half_day: { bg: "#fff2d7", fg: "#b8710b" },
  short_hours: { bg: "#fff2d7", fg: "#b8710b" }
};

const labels: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Late",
  cl: "CL",
  holiday: "Holiday",
  absent: "Absent",
  not_marked: "Not marked",
  checked_in: "Checked in",
  half_day: "Half day",
  short_hours: "Short hours"
};

export function StatusPill({ status }: { status: AttendanceStatus }) {
  return <Text style={[styles.pill, { backgroundColor: colors[status].bg, color: colors[status].fg }]} allowFontScaling={false}>{labels[status]}</Text>;
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
