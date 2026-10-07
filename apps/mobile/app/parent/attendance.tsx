/**
 * Parent Attendance tab (Phase 4) — month attendance from
 * /api/portal/attendance with month navigation and present/absent/late
 * counts plus percentage.
 */
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import {
  Avatar, Badge, DSText, ErrorState, Icon, ListRow,
  PageTitle, SectionCard, SkeletonRows, TonalTile
} from "@/design-system/components";
import { radius, space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import type { Palette } from "@/lib/Theme";
import { ParentShell } from "@/features/parent/shell";
import { ChildSwitcher } from "@/features/parent/ChildSwitcher";
import { useSelectChild, useSelectedChildId, useSelectedChildRaw } from "@/features/parent/SelectedChild";
import { initials, monthLabel, shiftMonth, useParentAttendance, useParentSummary } from "@/features/parent/hooks";
import type { PortalAttendanceDay } from "@/features/parent/api";

function tileFor(status: string, t: Palette): { bg: string; fg: string; icon: "check" | "close" | "schedule" } {
  if (status === "present") return { bg: t.okBg, fg: t.ok, icon: "check" };
  if (status === "absent") return { bg: t.badBg, fg: t.bad, icon: "close" };
  if (status === "late") return { bg: t.warnBg, fg: t.warn, icon: "schedule" };
  return { bg: t.tint, fg: t.blue, icon: "check" };
}

export default function ParentAttendanceRoute() {
  return (
    <ParentShell>
      <ParentAttendanceScreen />
    </ParentShell>
  );
}

function ParentAttendanceScreen() {
  const { t } = useTheme();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const rawChoice = useSelectedChildRaw();
  const { summary, linkedStudents, loading: summaryLoading, error: summaryError, refresh: refreshSummary } =
    useParentSummary(rawChoice);
  const select = useSelectChild();
  const activeId = useSelectedChildId(linkedStudents);
  const { record, loading: recordLoading, error: recordError, refresh: refreshRecord } =
    useParentAttendance(activeId, month);

  const loading = summaryLoading || recordLoading;
  const refresh = useCallback(() => {
    refreshSummary();
    refreshRecord();
  }, [refreshSummary, refreshRecord]);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const canGoNext = month < currentMonth;

  if (loading && !record && !summary) return <SkeletonRows count={3} />;
  if ((summaryError && !summary) || (!loading && !summary)) {
    return <ErrorState message={summaryError || "No student is linked to this account yet."} onRetry={refresh} />;
  }

  const totals = record?.summary;

  const renderDay = ({ item: day }: { item: PortalAttendanceDay }) => {
    const tile = tileFor(String(day.status), t);
    return (
      <ListRow
        leading={
          <TonalTile bg={tile.bg} size={36}>
            <Icon name={tile.icon} size={18} tint={tile.fg} />
          </TonalTile>
        }
        title={String(day.date)}
        subtitle={[day.checkIn ? `In ${day.checkIn}` : "", day.checkOut ? `Out ${day.checkOut}` : ""].filter(Boolean).join(" · ") || String(day.status)}
      />
    );
  };

  return (
    <FlatList
      data={record?.attendance ?? []}
      keyExtractor={(day) => day.id}
      renderItem={renderDay}
      ItemSeparatorComponent={() => <View style={[styles.divider, { backgroundColor: t.line }]} />}
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={t.blue} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <PageTitle>Attendance</PageTitle>
      <ChildSwitcher children={linkedStudents} selectedId={activeId} onSelect={select} />

      {summary ? (
        <View style={[styles.identityRow, { backgroundColor: t.card, borderColor: t.line }]}>
          <Avatar label={initials(summary.student.name)} size={42} bg={t.okBg} fg={t.ok} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <DSText variant="title" style={styles.identityName} numberOfLines={1}>{summary.student.name}</DSText>
            <DSText variant="label" numberOfLines={1}>
              Class {summary.student.className}{summary.student.section}
            </DSText>
          </View>
          <Badge
            label={totals ? `${totals.percentage}% present` : "Attendance"}
            bg={t.tint}
            fg={t.blue}
          />
        </View>
      ) : null}

      <View style={[styles.monthRow, { backgroundColor: t.card, borderColor: t.line }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          hitSlop={12}
          onPress={() => setMonth((m) => shiftMonth(m, -1))}
          style={styles.monthBtn}
        >
          <Icon name="chevron-left" size={24} tint={t.ink} />
        </Pressable>
        <DSText variant="title" style={styles.monthLabel}>{monthLabel(month)}</DSText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          hitSlop={12}
          disabled={!canGoNext}
          onPress={() => setMonth((m) => shiftMonth(m, 1))}
          style={[styles.monthBtn, !canGoNext && styles.monthBtnDisabled]}
        >
          <Icon name="chevron-right" size={24} tint={canGoNext ? t.ink : t.faint} />
        </Pressable>
      </View>

      {recordError && !record ? (
        <ErrorState message={recordError} onRetry={refresh} />
      ) : (
        <SectionCard heading="SUMMARY">
          <View style={styles.tiles}>
            {(["present", "absent", "late"] as const).map((key) => {
              const tile = tileFor(key, t);
              const value = totals ? totals[key] : 0;
              return (
                <View key={key} style={styles.tile}>
                  <TonalTile bg={tile.bg} size={40}>
                    <Icon name={tile.icon} size={20} tint={tile.fg} />
                  </TonalTile>
                  <DSText variant="title" style={styles.tileValue}>{String(value)}</DSText>
                  <DSText variant="label">{key[0].toUpperCase() + key.slice(1)}</DSText>
                </View>
              );
            })}
            <View style={styles.tile}>
              <TonalTile bg={t.tint} size={40}>
                <Icon name="event-available" size={20} tint={t.blue} />
              </TonalTile>
              <DSText variant="title" style={styles.tileValue}>{`${totals ? totals.percentage : 0}%`}</DSText>
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
        <DSText variant="overline">DAY BY DAY</DSText>
      ) : null}
        </View>
      }
      ListEmptyComponent={null}
      initialNumToRender={31}
      maxToRenderPerBatch={31}
      windowSize={5}
      removeClippedSubviews={true}
    />
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, paddingTop: space.md, gap: 14 },
  header: { gap: 14 },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space.lg
  },
  identityName: { fontSize: 16, fontWeight: "700" },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs
  },
  monthLabel: { fontSize: 16, fontWeight: "700" },
  monthBtn: { padding: space.xs, width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
  monthBtnDisabled: { opacity: 0.4 },
  tiles: { flexDirection: "row", gap: space.sm },
  tile: { flex: 1, alignItems: "center", gap: 4 },
  tileValue: { fontWeight: "700" },
  divider: { height: StyleSheet.hairlineWidth }
});
