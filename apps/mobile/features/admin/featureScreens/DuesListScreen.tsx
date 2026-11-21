/**
 * Shared management screens for the flows added in this release:
 * receipts, student search/detail, dues and staff detail.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, RefreshControl, ScrollView, SectionList, Share, StyleSheet, View
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Avatar, Badge, Card, DSText, EmptyState, ErrorState, Icon, ListRow, PageTitle,
  PillButton, PressableScale, SectionCard, SkeletonPage, TextField, TonalTile
} from "@/design-system/components";
import { radius, space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import { useMobileSession } from "@/lib/mobileSession";
import { dashboardPathForRole } from "@/lib/roleRouting";
import { asDateString } from "@/lib/text";
import { initials } from "@/features/teacher/hooks";
import {
  fetchDues, fetchReceipt, fetchReceiptShareLink, fetchStudent, fetchStudentPayments, fetchStudents,
  fetchTeacher, fetchTeacherAttendanceSummary,
  type AdminPayment, type AdminTeacherDetail, type DueStudent, type ReceiptRecord,
  type StudentRecord, type TeacherAttendanceSummary
} from "../api";
import { formatDate, formatMoney, formatMoneyShort, formatText, useDashboardStats } from "../hooks";
import { ScreenBack, formatDateTime, styles, useBasePath } from "./shared";

type DueRow = DueStudent & { className: string };

export function DuesListScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const base = useBasePath();
  const { stats, loading: statsLoading, error: statsError, refresh: refreshStats } = useDashboardStats();
  const [rows, setRows] = useState<DueRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchDues(25);
      setRows(page.classes.flatMap((group) => group.students.map((student) => ({ ...student, className: group.className }))));
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load dues.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchDues(25, cursor ?? "");
      const next = page.classes.flatMap((group) => group.students.map((student) => ({ ...student, className: group.className })));
      setRows((prev) => [...prev, ...next.filter((item) => !prev.some((existing) => existing.id === item.id))]);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch {
      // Keep current list; refresh retries.
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, hasMore, loading, loadingMore]);

  const sections = useMemo(() => {
    const byClass = new Map<string, DueRow[]>();
    for (const row of rows) {
      byClass.set(row.className, [...(byClass.get(row.className) ?? []), row]);
    }
    return [...byClass.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([className, data]) => ({
        title: `CLASS ${className.toUpperCase()} · ${data.length}`,
        total: data.reduce((sum, row) => sum + row.due, 0),
        data
      }));
  }, [rows]);

  if (loading && rows.length === 0 && statsLoading && !stats) return <SkeletonPage />;
  if (error && rows.length === 0 && !stats) return <ErrorState message={error} onRetry={load} />;

  const total = stats?.totalFeeAmount ?? 0;
  const collected = stats?.totalFeeCollected ?? 0;
  const outstanding = stats?.totalFeeOutstanding ?? 0;
  const collectionRate = total > 0 ? (collected / total) * 100 : 0;
  const averageDue = stats && stats.studentsWithOutstandingFees > 0
    ? outstanding / stats.studentsWithOutstandingFees
    : 0;

  return (
    <SectionList
      sections={sections}
      keyExtractor={(row) => row.id}
      renderItem={({ item: row }) => (
        <ListRow
          leading={<Avatar label={initials(row.name || "?")} size={40} />}
          title={formatText(row.name, "Student")}
          subtitle={`${formatText(row.parentName, "Parent not recorded")}${row.phone ? ` · ${row.phone}` : ""}`}
          trailing={<DSText variant="bodyMedium" tint={t.bad}>{formatMoney(row.due)}</DSText>}
          chevron
          onPress={() => router.push(`${base}/student/${row.id}` as never)}
        />
      )}
      renderSectionHeader={({ section }) => (
        <View style={styles.dueSectionHeader}>
          <DSText variant="overline" style={{ flex: 1 }}>{section.title}</DSText>
          <DSText variant="caption" tint={t.bad}>{formatMoney(section.total)}</DSText>
        </View>
      )}
      ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: t.line }]} />}
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={loading || statsLoading}
          onRefresh={() => { void load(); refreshStats(); }}
          tintColor={t.blue}
        />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <ScreenBack />
          <PageTitle>Dues</PageTitle>

          <View style={styles.statRow}>
            <Card style={styles.moneyCard}>
              <TonalTile bg={t.badBg} size={34}>
                <Icon name="schedule" size={18} tint={t.bad} />
              </TonalTile>
              <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>{formatMoneyShort(outstanding)}</DSText>
              <DSText variant="overline" style={styles.moneyLabel}>DUE</DSText>
            </Card>
            <Card style={styles.moneyCard}>
              <TonalTile bg={t.warnBg} size={34}>
                <Icon name="group" size={18} tint={t.warn} />
              </TonalTile>
              <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>{stats?.studentsWithOutstandingFees ?? 0}</DSText>
              <DSText variant="overline" style={styles.moneyLabel}>STUDENTS</DSText>
            </Card>
            <Card style={styles.moneyCard}>
              <TonalTile bg={t.tint} size={34}>
                <Icon name="functions" size={18} tint={t.blue} />
              </TonalTile>
              <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>{formatMoneyShort(averageDue)}</DSText>
              <DSText variant="overline" style={styles.moneyLabel}>AVG DUE</DSText>
            </Card>
          </View>

          <Card style={{ gap: space.sm }}>
            <DSText variant="overline">COLLECTION PROGRESS</DSText>
            <DSText variant="label">
              {formatMoney(collected)} collected of {formatMoney(total)} · {Math.round(collectionRate)}%
            </DSText>
          </Card>

          {statsError && !stats ? <DSText variant="label" tint={t.bad}>{statsError}</DSText> : null}
          <DSText variant="overline">STUDENTS WITH DUES</DSText>
        </View>
      }
      ListEmptyComponent={
        loading ? null : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <EmptyState icon="check-circle" label="No outstanding dues. Every student is paid up." />
        )
      }
      ListFooterComponent={
        hasMore ? (
          <View style={styles.loadMore}>
            {loadingMore ? (
              <ActivityIndicator size="small" color={t.blue} />
            ) : (
              <PillButton label="Load more students" onPress={() => void loadMore()} />
            )}
          </View>
        ) : null
      }
      initialNumToRender={15}
      maxToRenderPerBatch={15}
      windowSize={7}
      removeClippedSubviews={true}
    />
  );
}

/* ----------------------------------------------------------------- Staff */
