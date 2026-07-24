/**
 * Teacher Attendance History — month-to-date record list with filter chips.
 */
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Badge, DSText, EmptyState, ErrorState, FilterChips, Icon, ListRow, LoadingState,
  PageTitle, SectionCard, StatTile, TonalTile
} from "@/design-system/components";
import { color, space } from "@/design-system/tokens";
import { useTeacherAttendanceData } from "@/lib/useTeacherAttendanceData";
import { TeacherShell } from "@/features/teacher/shell";
import { formatTime, statusTone, useAttendanceSummary } from "@/features/teacher/hooks";

const FILTERS = ["All", "Present", "Late", "Absent"];

const TONE_STYLE = {
  success: { bg: color.successContainer, fg: color.onSuccessContainer, icon: "check-circle" as const },
  warning: { bg: color.warningContainer, fg: color.onWarningDeep, icon: "schedule" as const },
  error: { bg: color.errorContainer, fg: color.error, icon: "cancel" as const },
  neutral: { bg: color.surfaceVariant, fg: color.ink2, icon: "remove-circle-outline" as const }
};

export default function TeacherHistoryRoute() {
  return (
    <TeacherShell>
      <TeacherHistory />
    </TeacherShell>
  );
}

function TeacherHistory() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState("All");
  const { records, loading, error } = useTeacherAttendanceData();
  const summary = useAttendanceSummary(records);

  const visible = useMemo(() => {
    const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
    if (filter === "All") return sorted;
    const wanted = filter.toLowerCase();
    return sorted.filter((r) => r.status === wanted);
  }, [records, filter]);

  if (loading && records.length === 0) return <LoadingState label="Loading your history…" />;
  if (error && records.length === 0) return <ErrorState message={error} />;

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xs }]}
      showsVerticalScrollIndicator={false}
    >
      <PageTitle>History</PageTitle>

      <View style={styles.statRow}>
        <StatTile value={`${summary.percentage}%`} label="This month" tint={color.primary} />
        <StatTile value={summary.present} label="Present" tint={color.success} />
        <StatTile value={summary.late} label="Late" tint={color.warning} />
        <StatTile value={summary.absent} label="Absent" tint={color.error} />
      </View>

      <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

      <SectionCard heading={`${visible.length} RECORD${visible.length === 1 ? "" : "S"}`}>
        {visible.length === 0 ? (
          <EmptyState icon="event-busy" label={`No ${filter.toLowerCase()} days in this period.`} />
        ) : (
          visible.map((record) => {
            const tone = statusTone(record.status);
            const style = TONE_STYLE[tone.tone];
            return (
              <ListRow
                key={record.date}
                leading={
                  <TonalTile bg={style.bg}>
                    <Icon name={style.icon} size={19} tint={style.fg} />
                  </TonalTile>
                }
                title={new Date(record.date).toLocaleDateString("en-IN", {
                  weekday: "short",
                  day: "numeric",
                  month: "short"
                })}
                subtitle={
                  record.checkInTime
                    ? `${formatTime(record.checkInTime)} – ${formatTime(record.checkOutTime)}`
                    : "No check-in recorded"
                }
                trailing={<Badge label={tone.label} bg={style.bg} fg={style.fg} />}
              />
            );
          })
        )}
      </SectionCard>

      <DSText variant="caption" style={{ textAlign: "center" }}>
        Corrections are handled by the school office.
      </DSText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 },
  statRow: { flexDirection: "row", gap: space.sm }
});
