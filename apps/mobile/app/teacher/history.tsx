/**
 * Teacher Attendance History — month-to-date record list with filter chips.
 */
import React, { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import {
  Badge, DSText, EmptyState, ErrorState, FilterChips, Icon, ListRow, SkeletonPage,
  PageTitle, StatTile, TonalTile
} from "@/design-system/components";
import { space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import { useTeacherAttendanceData } from "@/lib/useTeacherAttendanceData";
import { TeacherShell } from "@/features/teacher/shell";
import { formatTime, statusTone, useAttendanceSummary } from "@/features/teacher/hooks";

const FILTERS = ["All", "Present", "Late", "Absent"];

export default function TeacherHistoryRoute() {
  return (
    <TeacherShell>
      <TeacherHistory />
    </TeacherShell>
  );
}

function TeacherHistory() {
  const { t } = useTheme();
  const [filter, setFilter] = useState("All");
  const { records, loading, error, refresh } = useTeacherAttendanceData();
  const summary = useAttendanceSummary(records);

  const TONE_STYLE = {
    success: { bg: t.okBg, fg: t.ok, icon: "check-circle" as const },
    warning: { bg: t.warnBg, fg: t.warn, icon: "schedule" as const },
    error: { bg: t.badBg, fg: t.bad, icon: "cancel" as const },
    neutral: { bg: t.tint, fg: t.mute, icon: "remove-circle-outline" as const }
  };

  const visible = useMemo(() => {
    const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
    if (filter === "All") return sorted;
    const wanted = filter.toLowerCase();
    return sorted.filter((r) => r.status === wanted);
  }, [records, filter]);

  if (loading && records.length === 0) return <SkeletonPage />;
  if (error && records.length === 0) return <ErrorState message={error} />;

  // Virtualized: history holds up to 180 records, far too many to mount at once.
  return (
    <FlatList
      data={visible}
      keyExtractor={(record, index) => `${record.date}-${index}`}
      renderItem={({ item: record }) => {
        const tone = statusTone(record.status);
        const style = TONE_STYLE[tone.tone];
        return (
          <ListRow
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
      }}
      ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: t.line }]} />}
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={styles.header}>
          <PageTitle>History</PageTitle>

          <View style={styles.statRow}>
            <StatTile value={`${summary.percentage}%`} label="This month" tint={t.blue} />
            <StatTile value={summary.present} label="Present" tint={t.ok} />
            <StatTile value={summary.late} label="Late" tint={t.warn} />
            <StatTile value={summary.absent} label="Absent" tint={t.bad} />
          </View>

          <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

          <DSText variant="overline">{`${visible.length} RECORD${visible.length === 1 ? "" : "S"}`}</DSText>
        </View>
      }
      ListEmptyComponent={
        <EmptyState icon="event-busy" label={`No ${filter.toLowerCase()} days in this period.`} />
      }
      ListFooterComponent={
        <DSText variant="caption" style={{ textAlign: "center" }}>
          Corrections are handled by the school office.
        </DSText>
      }
      initialNumToRender={20}
      maxToRenderPerBatch={20}
      windowSize={7}
      removeClippedSubviews={true}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={t.blue} />}
    />
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 },
  header: { gap: 14 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 52 },
  statRow: { flexDirection: "row", gap: 10 }
});
