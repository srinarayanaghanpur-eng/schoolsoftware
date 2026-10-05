/**
 * Parent Homework tab — live /api/portal/homework data.
 */
import React from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Avatar, Badge, Card, DSText, EmptyState, ErrorState, ListRow, LoadingState, PageTitle, TonalTile } from "@/design-system/components";
import { radius, space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import type { Palette } from "@/lib/Theme";
import { ParentShell } from "@/features/parent/shell";
import { ChildSwitcher } from "@/features/parent/ChildSwitcher";
import { useSelectChild, useSelectedChildId, useSelectedChildRaw } from "@/features/parent/SelectedChild";
import { formatDue, initials, subjectCode, useParentHomework, useParentSummary } from "@/features/parent/hooks";

function tileFor(code: string, t: Palette): { bg: string; fg: string } {
  if (code === "MATH") return { bg: t.tint, fg: t.blue };
  if (code === "SCI") return { bg: t.okBg, fg: t.ok };
  if (code === "ENG") return { bg: t.warnBg, fg: t.warn };
  if (code === "HIN") return { bg: t.badBg, fg: t.bad };
  return { bg: t.tint, fg: t.blue };
}

export default function ParentHomeworkRoute() {
  return (
    <ParentShell>
      <ParentHomeworkScreen />
    </ParentShell>
  );
}

function ParentHomeworkScreen() {
  const { t } = useTheme();
  const rawChoice = useSelectedChildRaw();
  const { summary, linkedStudents, loading: summaryLoading, error: summaryError, refresh: refreshSummary } =
    useParentSummary(rawChoice);
  const activeId = useSelectedChildId(linkedStudents);
  const select = useSelectChild();
  const { homework, loading, error, refresh } = useParentHomework(activeId);

  const busy = summaryLoading || loading;

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={() => { refreshSummary(); refresh(); }} tintColor={t.blue} />}
    >
      <PageTitle>Homework</PageTitle>
      <ChildSwitcher children={linkedStudents} selectedId={activeId} onSelect={select} />
      {summary ? (
        <Card style={styles.identityRow}>
          <Avatar label={initials(summary.student.name)} size={42} bg={t.tint} fg={t.blue} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <DSText variant="title" style={styles.identityName} numberOfLines={1}>{summary.student.name}</DSText>
            <DSText variant="label" numberOfLines={1}>
              Class {summary.student.className}{summary.student.section}
            </DSText>
          </View>
          <Badge label={`${homework.length} given`} bg={t.tint} fg={t.blue} />
        </Card>
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
        const tile = tileFor(code, t);
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
                  bg={due.overdue ? t.badBg : t.warnBg}
                  fg={due.overdue ? t.bad : t.warn}
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
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, paddingTop: space.md, gap: 12 },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    borderRadius: radius.xl
  },
  identityName: { fontSize: 16, fontWeight: "700" },
  hwCard: { borderRadius: 20 }
});
