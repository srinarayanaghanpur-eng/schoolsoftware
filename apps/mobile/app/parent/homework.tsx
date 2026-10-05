/**
 * Parent Homework tab — live /api/portal/homework data.
 */
import React from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar, Badge, Card, DSText, EmptyState, ErrorState, ListRow, LoadingState, TonalTile } from "@/design-system/components";
import { color, elevation, radius, space } from "@/design-system/tokens";
import { ParentShell } from "@/features/parent/shell";
import { ChildSwitcher } from "@/features/parent/ChildSwitcher";
import { useSelectChild, useSelectedChildId, useSelectedChildRaw } from "@/features/parent/SelectedChild";
import { formatDue, initials, subjectCode, useParentHomework, useParentSummary } from "@/features/parent/hooks";

const SUBJECT_TILES: Record<string, { bg: string; fg: string }> = {
  MATH: { bg: color.tileLavender, fg: color.primaryDeep },
  SCI: { bg: color.tileMint, fg: color.success },
  ENG: { bg: color.tileLemon, fg: color.onWarningDeep },
  HIN: { bg: color.tileRose, fg: color.error }
};

export default function ParentHomeworkRoute() {
  return (
    <ParentShell>
      <ParentHomeworkScreen />
    </ParentShell>
  );
}

function ParentHomeworkScreen() {
  const insets = useSafeAreaInsets();
  const rawChoice = useSelectedChildRaw();
  const { summary, linkedStudents, loading: summaryLoading, error: summaryError, refresh: refreshSummary } =
    useParentSummary(rawChoice);
  const activeId = useSelectedChildId(linkedStudents);
  const select = useSelectChild();
  const { homework, loading, error, refresh } = useParentHomework(activeId);

  const busy = summaryLoading || loading;

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.sm }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={() => { refreshSummary(); refresh(); }} tintColor={color.primary} />}
    >
      <DSText variant="display" style={{ paddingTop: 6 }}>Homework</DSText>
      <ChildSwitcher children={linkedStudents} selectedId={activeId} onSelect={select} />
      {summary ? (
        <View style={[styles.identityRow, elevation.card]}>
          <Avatar label={initials(summary.student.name)} size={42} bg={color.tileSky} fg={color.primaryDeep} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <DSText variant="title" style={styles.identityName} numberOfLines={1}>{summary.student.name}</DSText>
            <DSText variant="label" numberOfLines={1}>
              Class {summary.student.className}{summary.student.section}
            </DSText>
          </View>
          <Badge label={`${homework.length} given`} bg={color.tileLavender} fg={color.primaryDeep} />
        </View>
      ) : null}

      {busy && homework.length === 0 ? <LoadingState /> : null}
      {(error || summaryError) && homework.length === 0 && !busy ? (
        <ErrorState message={error ?? summaryError ?? "Unable to load homework."} onRetry={() => { refreshSummary(); refresh(); }} />
      ) : null}
      {!busy && !error && homework.length === 0 && summary ? (
        <EmptyState icon="menu-book" label="No homework has been assigned yet." />
      ) : null}

      {homework.map((hw) => {
        const code = subjectCode(hw.subject);
        const tile = SUBJECT_TILES[code] ?? { bg: color.tileSky, fg: color.ink2 };
        const due = formatDue(hw.dueDate);
        return (
          <Card key={hw.id} style={styles.hwCard}>
            <ListRow
              leading={
                <TonalTile bg={tile.bg} size={40}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: tile.fg }}>{code}</Text>
                </TonalTile>
              }
              title={hw.title}
              subtitle={hw.assignedDate ? `${hw.subject} · assigned ${hw.assignedDate}` : hw.subject}
              trailing={
                <Badge
                  label={due.label}
                  bg={due.overdue ? color.tileRose : color.tileLemon}
                  fg={due.overdue ? color.error : color.onWarningDeep}
                />
              }
            />
            {hw.description ? <DSText variant="label" style={{ marginTop: 6 }}>{hw.description}</DSText> : null}
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 12 },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.outline,
    borderRadius: radius.xl,
    padding: space.lg
  },
  identityName: { fontSize: 16, fontWeight: "700" },
  hwCard: { borderRadius: 20 }
});
