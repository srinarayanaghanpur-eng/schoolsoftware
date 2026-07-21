/**
 * Parent Homework tab — live /api/portal/homework data.
 */
import React from "react";
import { RefreshControl, ScrollView, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Badge, Card, DSText, EmptyState, ErrorState, ListRow, LoadingState, TonalTile } from "@/design-system/components";
import { color, space } from "@/design-system/tokens";
import { ParentShell } from "@/features/parent/shell";
import { formatDue, subjectCode, useParentHomework, useParentSummary } from "@/features/parent/hooks";

const SUBJECT_TILES: Record<string, { bg: string; fg: string }> = {
  MATH: { bg: color.primaryContainer, fg: color.onPrimaryContainer },
  SCI: { bg: color.successContainer, fg: color.onSuccessContainer },
  ENG: { bg: color.warningContainer, fg: color.onWarningDeep },
  HIN: { bg: color.errorContainer, fg: color.onErrorContainer }
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
  const { summary, loading: summaryLoading, error: summaryError, refresh: refreshSummary } = useParentSummary();
  const { homework, loading, error, refresh } = useParentHomework(summary?.student.id);

  const busy = summaryLoading || loading;

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.sm }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={() => { refreshSummary(); refresh(); }} tintColor={color.primary} />}
    >
      <DSText variant="display" style={{ paddingTop: 6 }}>Homework</DSText>
      {summary ? (
        <DSText variant="label" style={{ marginTop: -6 }}>
          {summary.student.name} · Class {summary.student.className}{summary.student.section}
        </DSText>
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
        const tile = SUBJECT_TILES[code] ?? { bg: color.surfaceVariant, fg: color.ink2 };
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
                  bg={due.overdue ? color.errorContainer : color.warningContainer}
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
  hwCard: { borderRadius: 18 }
});
