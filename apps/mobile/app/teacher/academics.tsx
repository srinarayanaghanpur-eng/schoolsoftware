/**
 * Teacher Academics — mirrors the Academics tab of Teacher App.dc.html:
 * timetable, syllabus progress, homework-to-review and the school calendar.
 *
 * DATA HONESTY: MY ASSIGNMENT, THIS MONTH and SCHOOL CALENDAR are live.
 * Timetable, syllabus progress and homework-to-review have no mobile endpoint
 * yet (Phase 2 backlog), so those three sections render an honest EmptyState.
 */
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Card, DSText, EmptyState, ErrorState, Icon, ListRow, LoadingState, PageTitle,
  ProgressRow, SectionCard, TonalTile, type IconName
} from "@/design-system/components";
import { space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import { useTeacherAttendanceData } from "@/lib/useTeacherAttendanceData";
import { TeacherShell } from "@/features/teacher/shell";
import { useAttendanceSummary } from "@/features/teacher/hooks";

export default function TeacherAcademicsRoute() {
  return (
    <TeacherShell>
      <TeacherAcademics />
    </TeacherShell>
  );
}

function TeacherAcademics() {
  const { t } = useTheme();
  const { teacher, records, holidays, loading, error } = useTeacherAttendanceData();
  const summary = useAttendanceSummary(records);

  const HOLIDAY_TONE: Record<string, { bg: string; fg: string; icon: IconName }> = {
    school: { bg: t.tint, fg: t.blue, icon: "event" },
    public: { bg: t.badBg, fg: t.bad, icon: "campaign" },
    exam: { bg: t.warnBg, fg: t.warn, icon: "school" },
    other: { bg: t.tint, fg: t.mute, icon: "event" },
    management_declared: { bg: t.warnBg, fg: t.warn, icon: "beach-access" }
  };

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
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
    >
      <PageTitle>Academics</PageTitle>

      {/* teacher assignment */}
      <SectionCard heading="MY ASSIGNMENT">
        <ListRow
          leading={<TonalTile bg={t.tint}><Icon name="school" size={19} tint={t.blue} /></TonalTile>}
          title={teacher?.subject ?? "Subject not set"}
          subtitle={teacher?.employeeId ? `Employee ${teacher.employeeId}` : "Assigned by the school office"}
        />
        {teacher?.employmentType ? (
          <ListRow
            leading={<TonalTile bg={t.tint}><Icon name="badge" size={19} tint={t.mute} /></TonalTile>}
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
          tint={summary.percentage >= 90 ? t.ok : t.warn}
        />
        <ProgressRow
          label="Days recorded"
          percent={workingDays === 0 ? 0 : (summary.present / workingDays) * 100}
          valueLabel={`${summary.present} / ${workingDays}`}
        />
      </Card>

      {/* timetable — no endpoint yet */}
      <SectionCard heading="TODAY’S TIMETABLE">
        <EmptyState icon="event" label="Your timetable will appear here once the school publishes it." />
      </SectionCard>

      {/* syllabus progress — no endpoint yet */}
      <SectionCard heading="SYLLABUS PROGRESS">
        <EmptyState icon="menu-book" label="Syllabus tracking arrives with the next school release." />
      </SectionCard>

      {/* homework to review — no endpoint yet */}
      <SectionCard heading="HOMEWORK TO REVIEW">
        <EmptyState icon="assignment" label="Homework awaiting review will appear here." />
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
