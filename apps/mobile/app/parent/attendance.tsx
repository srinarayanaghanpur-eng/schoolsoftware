/**
 * Parent Attendance tab (Phase 4) — month attendance from
 * /api/portal/attendance with month navigation and present/absent/late
 * counts plus percentage.
 */
import React, { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  DSText, ErrorState, Icon, ListRow, LoadingState,
  SectionCard, TonalTile
} from "@/design-system/components";
import { color, space } from "@/design-system/tokens";
import { ParentShell } from "@/features/parent/shell";
import { ChildSwitcher } from "@/features/parent/ChildSwitcher";
import { monthLabel, shiftMonth, useParentAttendance, useParentSummary } from "@/features/parent/hooks";

const STATUS_TILE: Record<string, { bg: string; fg: string; icon: "check" | "close" | "schedule" }> = {
  present: { bg: color.successContainer, fg: color.success, icon: "check" },
  absent: { bg: color.errorContainer, fg: color.error, icon: "close" },
  late: { bg: color.warningContainer, fg: color.warning, icon: "schedule" }
};

function tileFor(status: string) {
  return STATUS_TILE[status] ?? { bg: color.surfaceVariant, fg: color.ink2, icon: "check" as const };
}

export default function ParentAttendanceRoute() {
  return (
    <ParentShell>
      <ParentAttendanceScreen />
    </ParentShell>
  );
}

function ParentAttendanceScreen() {
  const insets = useSafeAreaInsets();
  const [childId, setChildId] = useState<string | undefined>(undefined);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const { summary, linkedStudents, loading: summaryLoading, error: summaryError, refresh: refreshSummary } =
    useParentSummary(childId);
  const activeId = childId ?? summary?.student.id;
  const { record, loading: recordLoading, error: recordError, refresh: refreshRecord } =
    useParentAttendance(activeId, month);

  const loading = summaryLoading || recordLoading;
  const refresh = useCallback(() => {
    refreshSummary();
    refreshRecord();
  }, [refreshSummary, refreshRecord]);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const canGoNext = month < currentMonth;

  if (loading && !record && !summary) return <LoadingState label="Loading attendance…" />;
  if ((summaryError && !summary) || (!loading && !summary)) {
    return <ErrorState message={summaryError || "No student is linked to this account yet."} onRetry={refresh} />;
  }

  const totals = record?.summary;

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.sm }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={color.primary} />}
    >
      <ChildSwitcher children={linkedStudents} selectedId={activeId} onSelect={setChildId} />

      <View style={styles.monthRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() => setMonth((m) => shiftMonth(m, -1))}
          style={styles.monthBtn}
        >
          <Icon name="chevron-left" size={24} tint={color.ink} />
        </Pressable>
        <DSText variant="title" style={styles.monthLabel}>{monthLabel(month)}</DSText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          disabled={!canGoNext}
          onPress={() => setMonth((m) => shiftMonth(m, 1))}
          style={[styles.monthBtn, !canGoNext && styles.monthBtnDisabled]}
        >
          <Icon name="chevron-right" size={24} tint={canGoNext ? color.ink : color.ink2} />
        </Pressable>
      </View>

      {recordError && !record ? (
        <ErrorState message={recordError} onRetry={refresh} />
      ) : (
        <SectionCard heading="SUMMARY">
          <View style={styles.tiles}>
            {(["present", "absent", "late"] as const).map((key) => {
              const tile = tileFor(key);
              const value = totals ? totals[key] : 0;
              return (
                <View key={key} style={styles.tile}>
                  <TonalTile bg={tile.bg} size={40}>
                    <Icon name={tile.icon} size={20} tint={tile.fg} />
                  </TonalTile>
                  <DSText variant="title">{String(value)}</DSText>
                  <DSText variant="label">{key[0].toUpperCase() + key.slice(1)}</DSText>
                </View>
              );
            })}
            <View style={styles.tile}>
              <TonalTile bg={color.primaryContainer} size={40}>
                <Icon name="event-available" size={20} tint={color.onPrimaryContainer} />
              </TonalTile>
              <DSText variant="title">{`${totals ? totals.percentage : 0}%`}</DSText>
              <DSText variant="label">Present</DSText>
            </View>
          </View>
          <DSText variant="label">
            {totals && totals.total > 0
              ? `${totals.total} school days recorded`
              : `No attendance records for ${monthLabel(month)}.`}
          </DSText>
        </SectionCard>
      )}

      {record && record.attendance.length > 0 ? (
        <SectionCard heading="DAY BY DAY">
          {record.attendance.map((day) => {
            const tile = tileFor(String(day.status));
            return (
              <ListRow
                key={day.id}
                leading={
                  <TonalTile bg={tile.bg} size={36}>
                    <Icon name={tile.icon} size={18} tint={tile.fg} />
                  </TonalTile>
                }
                title={String(day.date)}
                subtitle={[day.checkIn ? `In ${day.checkIn}` : "", day.checkOut ? `Out ${day.checkOut}` : ""].filter(Boolean).join(" · ") || String(day.status)}
              />
            );
          })}
        </SectionCard>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthLabel: { fontSize: 17 },
  monthBtn: { padding: space.xs },
  monthBtnDisabled: { opacity: 0.4 },
  tiles: { flexDirection: "row", gap: space.sm },
  tile: { flex: 1, alignItems: "center", gap: 4 }
});
