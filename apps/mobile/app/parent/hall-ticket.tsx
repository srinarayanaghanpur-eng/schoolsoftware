/**
 * Parent Hall Ticket — published exams for the selected child; tap an exam
 * to open its hall ticket (timetable + instructions).
 */
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import {
  Avatar, Card, DSText, EmptyState, ErrorState, Icon, ListRow,
  PageTitle, SectionCard, SkeletonPage, TonalTile
} from "@/design-system/components";
import { space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import { ParentShell } from "@/features/parent/shell";
import { ChildSwitcher } from "@/features/parent/ChildSwitcher";
import { useSelectChild, useSelectedChildId, useSelectedChildRaw } from "@/features/parent/SelectedChild";
import { useParentSummary } from "@/features/parent/hooks";
import { fetchExams, fetchHallTicket, type PortalExam, type PortalHallTicket } from "@/features/parent/api";
import { asText } from "@/lib/text";

export default function ParentHallTicketRoute() {
  return (
    <ParentShell>
      <ParentHallTicketScreen />
    </ParentShell>
  );
}

function ParentHallTicketScreen() {
  const { t } = useTheme();
  const rawChoice = useSelectedChildRaw();
  const { summary, linkedStudents, loading, error, refresh } = useParentSummary(rawChoice);
  const activeId = useSelectedChildId(linkedStudents);
  const select = useSelectChild();

  const [exams, setExams] = useState<PortalExam[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [examsError, setExamsError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Record<string, PortalHallTicket>>({});
  const [loadingTicket, setLoadingTicket] = useState<string | null>(null);

  const loadExams = useCallback(async () => {
    if (!activeId) return;
    setLoadingExams(true);
    setExamsError(null);
    try {
      const result = await fetchExams(activeId);
      setExams(result.exams ?? []);
      setOpenId(null);
    } catch (err) {
      setExamsError(err instanceof Error ? err.message : "Unable to load exams.");
    } finally {
      setLoadingExams(false);
    }
  }, [activeId]);

  useEffect(() => {
    void loadExams();
  }, [loadExams]);

  const openTicket = async (examId: string) => {
    if (openId === examId) {
      setOpenId(null);
      return;
    }
    setOpenId(examId);
    if (!activeId || tickets[`${activeId}:${examId}`]) return;
    setLoadingTicket(examId);
    try {
      const result = await fetchHallTicket(examId, activeId);
      setTickets((prev) => ({ ...prev, [`${activeId}:${examId}`]: result.hallTicket }));
    } catch {
      setOpenId(null);
    } finally {
      setLoadingTicket(null);
    }
  };

  if (loading && !summary) return <SkeletonPage />;
  if (error && !summary) return <ErrorState message={error} onRetry={refresh} />;

  const busy = loading || loadingExams;

  return (
    <FlatList
      data={exams}
      keyExtractor={(exam) => exam.id}
      renderItem={({ item: exam }) => {
        const open = openId === exam.id;
        const ticket = tickets[`${activeId}:${exam.id}`];
        const papers = exam.timetable ?? [];
        return (
          <SectionCard
            heading={((exam.examType ?? exam.name ?? "EXAM") as string).toUpperCase()}
            trailing={<DSText variant="caption">{asText(exam.startDate)}</DSText>}
          >
            <ListRow
              leading={
                <TonalTile bg={t.tint}>
                  <Icon name="badge" size={19} tint={t.blue} />
                </TonalTile>
              }
              title={asText(exam.name) || "Exam"}
              subtitle={`Class ${asText(exam.className) || "—"} · ${papers.length} paper${papers.length === 1 ? "" : "s"}`}
              chevron
              onPress={() => void openTicket(exam.id)}
            />
            {open ? (
              <View style={{ marginTop: space.sm, gap: space.xs }}>
                {loadingTicket === exam.id ? (
                  <DSText variant="label" tint={t.mute}>Loading hall ticket…</DSText>
                ) : ticket ? (
                  <Card style={[styles.ticket, { borderColor: t.line }]}>
                    <View style={styles.ticketHead}>
                      <Avatar label={(ticket.studentName ?? "?").slice(0, 2).toUpperCase()} size={44} bg={t.tint} fg={t.blue} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <DSText variant="bodyMedium" numberOfLines={1}>{ticket.studentName}</DSText>
                        <DSText variant="label">
                          {ticket.admissionNo ? `Adm ${ticket.admissionNo} · ` : ""}Class {ticket.className}
                          {ticket.section ? ` ${ticket.section}` : ""}
                        </DSText>
                      </View>
                    </View>
                    {(ticket.timetable ?? []).map((paper, index) => (
                      <View key={`${paper.subject ?? index}-${paper.date ?? index}`} style={styles.paperRow}>
                        <DSText variant="bodyMedium" style={{ flex: 1 }}>{paper.subject ?? "—"}</DSText>
                        <DSText variant="caption">
                          {paper.date ?? ""}{paper.time ? ` · ${paper.time}` : ""}
                        </DSText>
                      </View>
                    ))}
                    {(ticket.generalInstructions ?? []).map((line) => (
                      <DSText key={line.slice(0, 24)} variant="caption" tint={t.mute}>• {line}</DSText>
                    ))}
                  </Card>
                ) : null}
              </View>
            ) : null}
          </SectionCard>
        );
      }}
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={busy} onRefresh={() => { refresh(); void loadExams(); }} tintColor={t.blue} />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <PageTitle>Hall Ticket</PageTitle>
          <ChildSwitcher children={linkedStudents} selectedId={activeId} onSelect={select} />
          {examsError ? <ErrorState message={examsError} onRetry={loadExams} /> : null}
        </View>
      }
      ListEmptyComponent={
        busy || examsError ? null : (
          <EmptyState icon="badge" label="No published exams for this class yet." />
        )
      }
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={7}
      removeClippedSubviews={true}
    />
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, paddingTop: space.md, gap: 14 },
  header: { gap: 14 },
  ticket: { gap: space.sm, borderWidth: 1 },
  ticketHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  paperRow: { flexDirection: "row", alignItems: "center", gap: space.sm }
});
