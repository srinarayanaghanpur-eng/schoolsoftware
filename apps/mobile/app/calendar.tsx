import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import {
  demoAttendance,
  demoHolidays,
  demoTeachers,
  type AttendanceRecord,
  type AttendanceStatus
} from "@sri-narayana/shared";
import { useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

function useCellWidth() {
  const { width } = useWindowDimensions();
  return (width - 36 - 28) / 7;
}

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STATUS_META: Record<AttendanceStatus, { label: string; short: string; bg: string; fg: string; border: string }> = {
  present: { label: "Present", short: "P", bg: "#e4f7ec", fg: "#148654", border: "#b9ebd0" },
  late: { label: "Late", short: "L", bg: "#fff2d7", fg: "#b8710b", border: "#ffd993" },
  cl: { label: "Casual leave", short: "CL", bg: "#fee9ed", fg: "#c9435e", border: "#f9c4cf" },
  holiday: { label: "Holiday", short: "H", bg: "#eeefff", fg: "#3033a1", border: "#ced3ff" },
  absent: { label: "Absent", short: "A", bg: "#fee9ed", fg: "#c9435e", border: "#f9c4cf" },
  not_marked: { label: "Not marked", short: "—", bg: "#f8f9ff", fg: "#9aa3bd", border: "#e3e6f0" }
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateKey(year: number, monthIndex: number, day: number) {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

function monthKey(year: number, monthIndex: number) {
  return `${year}-${pad(monthIndex + 1)}`;
}

function monthFromRecord(record?: AttendanceRecord) {
  if (!record) return new Date();
  const [year, month] = record.date.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function dateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export default function Calendar() {
  const cellWidth = useCellWidth();
  const teacher = demoTeachers[0];
  const teacherRecords = demoAttendance.filter((record) => record.teacherId === teacher.id);
  const [visibleMonth, setVisibleMonth] = useState(() => monthFromRecord(teacherRecords[0]));

  const year = visibleMonth.getFullYear();
  const monthIndex = visibleMonth.getMonth();
  const currentMonthKey = monthKey(year, monthIndex);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstDayOffset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const monthTitle = visibleMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const today = new Date();
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const recordsForMonth = teacherRecords.filter((record) => record.month === currentMonthKey);
  const recordsByDate = new Map(recordsForMonth.map((record) => [record.date, record]));
  const holidaysByDate = new Map(demoHolidays.filter((holiday) => holiday.date.startsWith(currentMonthKey)).map((holiday) => [holiday.date, holiday]));
  const detailEntries = [
    ...recordsForMonth.map((record) => ({ key: `record-${record.date}`, date: record.date, kind: "record" as const, record })),
    ...[...holidaysByDate.values()]
      .filter((holiday) => !recordsByDate.has(holiday.date))
      .map((holiday) => ({ key: `holiday-${holiday.date}`, date: holiday.date, kind: "holiday" as const, holiday }))
  ].sort((left, right) => left.date.localeCompare(right.date));

  const dayCells = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const key = dateKey(year, monthIndex, day);
    const record = recordsByDate.get(key);
    const holiday = holidaysByDate.get(key);
    return {
      key,
      day,
      record,
      holiday,
      status: record?.status ?? (holiday ? "holiday" : "not_marked")
    };
  });

  const cells = [
    ...Array.from({ length: firstDayOffset }, (_, index) => ({ key: `start-${index}`, empty: true as const })),
    ...dayCells
  ];
  const trailingCells = (7 - (cells.length % 7)) % 7;
  const calendarCells = [
    ...cells,
    ...Array.from({ length: trailingCells }, (_, index) => ({ key: `end-${index}`, empty: true as const }))
  ];

  const summary = {
    present: recordsForMonth.filter((record) => record.status === "present").length,
    late: recordsForMonth.filter((record) => record.status === "late").length,
    leave: recordsForMonth.filter((record) => record.status === "cl").length,
    holiday: holidaysByDate.size
  };

  const moveMonth = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  return (
    <Screen title="Calendar" subtitle={`${teacher.fullName} · Monthly attendance`}>
      <Card style={styles.calendarCard}>
        <View style={styles.monthHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            onPress={() => moveMonth(-1)}
            style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
          >
            <Text style={styles.monthButtonText} allowFontScaling={false}>‹</Text>
          </Pressable>
          <View style={styles.monthTitleWrap}>
            <Text style={styles.monthEyebrow} allowFontScaling={false}>Attendance month</Text>
            <Text style={styles.monthTitle} allowFontScaling={false}>{monthTitle}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next month"
            onPress={() => moveMonth(1)}
            style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
          >
            <Text style={styles.monthButtonText} allowFontScaling={false}>›</Text>
          </Pressable>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue} allowFontScaling={false}>{summary.present}</Text>
            <Text style={styles.summaryLabel} allowFontScaling={false}>Present</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue} allowFontScaling={false}>{summary.late}</Text>
            <Text style={styles.summaryLabel} allowFontScaling={false}>Late</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue} allowFontScaling={false}>{summary.leave}</Text>
            <Text style={styles.summaryLabel} allowFontScaling={false}>CL</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue} allowFontScaling={false}>{summary.holiday}</Text>
            <Text style={styles.summaryLabel} allowFontScaling={false}>Holiday</Text>
          </View>
        </View>

        <View style={styles.weekRow}>
          {WEEK_DAYS.map((day) => (
            <Text key={day} style={styles.weekDay} allowFontScaling={false}>
              {day}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {calendarCells.map((cell) => {
            if ("empty" in cell) {
              return <View key={cell.key} style={[styles.dayCell, styles.emptyCell]} />;
            }

            const meta = STATUS_META[cell.status];
            return (
              <View key={cell.key} style={[styles.dayCell, { width: cellWidth, backgroundColor: meta.bg, borderColor: meta.border }, cell.key === todayKey && styles.todayCell]}>
                <Text style={styles.dayNumber} allowFontScaling={false}>{cell.day}</Text>
                <View style={[styles.statusDot, { backgroundColor: meta.fg }]}>
                  <Text style={styles.statusShort} allowFontScaling={false}>{meta.short}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.legend}>
          {(Object.keys(STATUS_META) as AttendanceStatus[])
            .filter((status) => status !== "not_marked")
            .map((status) => {
              const meta = STATUS_META[status];
              return (
                <View key={status} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: meta.fg }]} />
                  <Text style={styles.legendText} allowFontScaling={false}>{meta.label}</Text>
                </View>
              );
            })}
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle} allowFontScaling={false}>Month details</Text>
        {detailEntries.length === 0 ? (
          <Text style={styles.emptyText} allowFontScaling={false}>No attendance records found for {monthTitle}.</Text>
        ) : (
          <>
            {detailEntries.map((entry) => {
              if (entry.kind === "holiday") {
                return (
                  <View key={entry.key} style={styles.detailRow}>
                    <View style={styles.detailCopy}>
                      <Text style={styles.detailDate} allowFontScaling={false}>{dateLabel(entry.holiday.date)}</Text>
                      <Text style={styles.detailMeta} allowFontScaling={false}>{entry.holiday.type} holiday</Text>
                    </View>
                    <View style={[styles.detailBadge, { backgroundColor: STATUS_META.holiday.bg }]}>
                      <Text style={[styles.detailBadgeText, { color: STATUS_META.holiday.fg }]} allowFontScaling={false}>{entry.holiday.title}</Text>
                    </View>
                  </View>
                );
              }

              const meta = STATUS_META[entry.record.status];
              return (
                <View key={entry.key} style={styles.detailRow}>
                  <View style={styles.detailCopy}>
                    <Text style={styles.detailDate} allowFontScaling={false}>{dateLabel(entry.record.date)}</Text>
                    <Text style={styles.detailMeta} allowFontScaling={false}>
                      {entry.record.source} · {entry.record.lateMinutes} late min
                    </Text>
                  </View>
                  <View style={[styles.detailBadge, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.detailBadgeText, { color: meta.fg }]} allowFontScaling={false}>{meta.label}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  calendarCard: { padding: 14 },
  monthHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 },
  monthButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#eeefff",
    alignItems: "center",
    justifyContent: "center"
  },
  monthButtonText: { color: "#3033a1", fontSize: 28, fontWeight: "700", lineHeight: 30 },
  monthTitleWrap: { flex: 1, alignItems: "center" },
  monthEyebrow: { color: "#7d86a8", fontSize: 10, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  monthTitle: { marginTop: 3, color: "#1b1d32", fontSize: 20, fontWeight: "900", letterSpacing: -0.4 },
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  summaryItem: { flex: 1, borderRadius: 14, backgroundColor: "#f8f9ff", borderWidth: 1, borderColor: "#e3e6f0", paddingVertical: 10, alignItems: "center" },
  summaryValue: { color: "#3033a1", fontSize: 18, fontWeight: "900" },
  summaryLabel: { marginTop: 2, color: "#7d86a8", fontSize: 10, fontWeight: "800" },
  weekRow: { flexDirection: "row", marginBottom: 8 },
  weekDay: { flex: 1, textAlign: "center", color: "#7d86a8", fontSize: 11, fontWeight: "900" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: {
    aspectRatio: 1,
    borderWidth: 0.5,
    padding: 4,
    justifyContent: "space-between"
  },
  todayCell: { borderWidth: 2.5, borderColor: "#3033a1" },
  emptyCell: { backgroundColor: "transparent", borderColor: "transparent" },
  dayNumber: { color: "#1b1d32", fontSize: 12, fontWeight: "900" },
  statusDot: {
    alignSelf: "flex-end",
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center"
  },
  statusShort: { color: "white", fontSize: 9, fontWeight: "900" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#eef1f8" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { color: "#5c6687", fontSize: 11, fontWeight: "800" },
  sectionTitle: { color: "#1b1d32", fontSize: 17, fontWeight: "900", marginBottom: 12 },
  emptyText: { color: "#7d86a8", fontSize: 13, lineHeight: 19, fontWeight: "700" },
  detailRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#eef1f8" },
  detailCopy: { flex: 1 },
  detailDate: { color: "#1b1d32", fontSize: 14, fontWeight: "900" },
  detailMeta: { marginTop: 4, color: "#7d86a8", fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  detailBadge: { maxWidth: "48%", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  detailBadgeText: { fontSize: 11, fontWeight: "900" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] }
});
