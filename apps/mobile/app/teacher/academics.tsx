/**
 * Teacher Academics — school calendar + working-day view.
 *
 * NOTE: timetable and syllabus-progress endpoints do not exist yet
 * (Phase 2 backlog). Rather than shipping the mockup's fabricated timetable,
 * this screen renders only what the app can prove: the holiday calendar and
 * the teacher's own working days. The timetable card appears as an explicit
 * "not available yet" state instead of invented data.
 */
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Card, DSText, EmptyState, ErrorState, Icon, ListRow, LoadingState, PageTitle,
  ProgressRow, SectionCard, TonalTile
} from "@/design-system/components";
import { color, space } from "@/design-system/tokens";
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

      {/* timetable — honest empty state, not fabricated data */}
      <SectionCard heading="TIMETABLE">
        <EmptyState
          icon="calendar-today"
          label="Your timetable isn’t published to mobile yet. Check the notice board or the web dashboard."
        />
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
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 }
});
