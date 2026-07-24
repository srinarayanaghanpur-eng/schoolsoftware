/**
 * Teacher Academics — mirrors the Academics tab of Teacher App.dc.html:
 * timetable, syllabus progress, homework-to-review and the school calendar.
 *
 * DATA HONESTY: MY ASSIGNMENT, THIS MONTH and SCHOOL CALENDAR are live.
 * Timetable, syllabus progress and homework-to-review have no mobile endpoint
 * yet (Phase 2 backlog), so those three sections render representative
 * PLACEHOLDER content to preserve the designed layout — each is marked below.
 */
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Badge, Card, DSText, ErrorState, Icon, ListRow, LoadingState, PageTitle,
  ProgressRow, SectionCard, TonalTile
} from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { useTeacherAttendanceData } from "@/lib/useTeacherAttendanceData";
import { TeacherShell } from "@/features/teacher/shell";
import { useAttendanceSummary } from "@/features/teacher/hooks";

const HOLIDAY_TONE: Record<string, { bg: string; fg: string; icon: "beach-access" | "campaign" | "event" | "school" }> = {
  school: { bg: color.primaryContainer, fg: color.primary, icon: "event" },
  public: { bg: color.errorContainer, fg: color.error, icon: "campaign" },
  exam: { bg: color.warningContainer, fg: color.warning, icon: "school" },
  other: { bg: color.surfaceVariant, fg: color.ink2, icon: "event" },
  management_declared: { bg: color.warningContainer, fg: color.warning, icon: "beach-access" }
};

/** PLACEHOLDER — sample timetable, until /api/teacher/timetable exists. */
const TIMETABLE = [
  { time: "08:00", subject: "Morning assembly", meta: "Main ground", bar: color.muted, tag: "" },
  { time: "09:15", subject: "Mathematics · 9A", meta: "Room 301", bar: color.primary, tag: "Now" },
  { time: "10:15", subject: "Mathematics · 8B", meta: "Room 108", bar: color.primary, tag: "" },
  { time: "11:15", subject: "Free period", meta: "Staff room", bar: color.faint, tag: "Free" },
  { time: "12:10", subject: "Mathematics · 10B", meta: "Room 108", bar: color.primary, tag: "" }
];

/** PLACEHOLDER — sample syllabus coverage, until the endpoint exists. */
const SYLLABUS = [
  { name: "Class 9 — Linear equations", pct: 72 },
  { name: "Class 8 — Mensuration", pct: 58 },
  { name: "Class 10 — Trigonometry", pct: 34 }
];

/** PLACEHOLDER — homework awaiting review, until the endpoint exists. */
const HOMEWORK_REVIEW = [
  { code: "8A", title: "Ch. 11 — Mensuration, Ex 11.2", meta: "31 of 34 submitted" },
  { code: "9A", title: "Ch. 4 — Linear equations worksheet", meta: "Due today" }
];

export default function TeacherAcademicsRoute() {
  return (
    <TeacherShell>
      <TeacherAcademics />
    </TeacherShell>
  );
}

function TeacherAcademics() {
  const insets = useSafeAreaInsets();
  const { teacher, records, holidays, loading, error } = useTeacherAttendanceData();
  const summary = useAttendanceSummary(records);

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return holidays
      .filter((h) => h.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 6);
  }, [holidays]);

  if (loading && !teacher) return <LoadingState label="Loading academics…" />;
  if (error && !teacher) return <ErrorState message={error} />;

  const workingDays = records.length;

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xs }]}
      showsVerticalScrollIndicator={false}
    >
      <PageTitle>Academics</PageTitle>

      {/* teacher assignment */}
      <SectionCard heading="MY ASSIGNMENT">
        <ListRow
          leading={<TonalTile bg={color.primaryContainer}><Icon name="school" size={19} tint={color.primary} /></TonalTile>}
          title={teacher?.subject ?? "Subject not set"}
          subtitle={teacher?.employeeId ? `Employee ${teacher.employeeId}` : "Assigned by the school office"}
        />
        {teacher?.employmentType ? (
          <ListRow
            leading={<TonalTile bg={color.surfaceVariant}><Icon name="badge" size={19} tint={color.ink2} /></TonalTile>}
            title={teacher.employmentType.replace(/_/g, " ")}
            subtitle="Employment type"
          />
        ) : null}
      </SectionCard>

      {/* month progress */}
      <Card style={{ gap: space.md }}>
        <DSText variant="overline">THIS MONTH</DSText>
        <ProgressRow
          label="Attendance"
          percent={summary.percentage}
          valueLabel={`${summary.percentage}%`}
          tint={summary.percentage >= 90 ? color.success : color.warning}
        />
        <ProgressRow
          label="Days recorded"
          percent={workingDays === 0 ? 0 : (summary.present / workingDays) * 100}
          valueLabel={`${summary.present} / ${workingDays}`}
        />
      </Card>

      {/* timetable (placeholder) */}
      <SectionCard heading="TODAY’S TIMETABLE">
        {TIMETABLE.map((period) => (
          <View key={period.time} style={styles.periodRow}>
            <Text style={styles.periodTime}>{period.time}</Text>
            <View style={[styles.periodBar, { backgroundColor: period.bar }]} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <DSText variant="bodyMedium" numberOfLines={1}>{period.subject}</DSText>
              <DSText variant="label" numberOfLines={1}>{period.meta}</DSText>
            </View>
            {period.tag ? (
              <DSText variant="label" tint={period.tag === "Now" ? color.primary : color.muted} style={{ fontWeight: "600" }}>
                {period.tag}
              </DSText>
            ) : null}
          </View>
        ))}
      </SectionCard>

      {/* syllabus progress (placeholder) */}
      <SectionCard heading="SYLLABUS PROGRESS">
        {SYLLABUS.map((row) => (
          <ProgressRow
            key={row.name}
            label={row.name}
            percent={row.pct}
            tint={row.pct >= 60 ? color.success : color.primary}
          />
        ))}
      </SectionCard>

      {/* homework to review (placeholder) */}
      <SectionCard heading="HOMEWORK TO REVIEW" trailing={<Badge label={`${HOMEWORK_REVIEW.length}`} />}>
        {HOMEWORK_REVIEW.map((hw) => (
          <ListRow
            key={hw.title}
            leading={
              <TonalTile bg={color.surfaceVariant}>
                <Text style={styles.classCode}>{hw.code}</Text>
              </TonalTile>
            }
            title={hw.title}
            subtitle={hw.meta}
            chevron
          />
        ))}
      </SectionCard>

      {/* holidays */}
      <SectionCard heading="SCHOOL CALENDAR">
        {upcoming.length === 0 ? (
          <DSText variant="label">No holidays scheduled in the coming weeks.</DSText>
        ) : (
          upcoming.map((holiday) => {
            const tone = HOLIDAY_TONE[holiday.type] ?? HOLIDAY_TONE.school;
            return (
              <ListRow
                key={`${holiday.date}-${holiday.title}`}
                leading={<TonalTile bg={tone.bg}><Icon name={tone.icon} size={19} tint={tone.fg} /></TonalTile>}
                title={holiday.title}
                subtitle={new Date(holiday.date).toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long"
                })}
              />
            );
          })
        )}
      </SectionCard>

      <View style={{ height: space.xs }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 },
  periodRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: 4 },
  periodTime: { width: 44, fontSize: 12, color: color.muted },
  periodBar: { width: 4, height: 30, borderRadius: 2 },
  classCode: { fontSize: 12, fontWeight: "700", color: color.primary }
});
