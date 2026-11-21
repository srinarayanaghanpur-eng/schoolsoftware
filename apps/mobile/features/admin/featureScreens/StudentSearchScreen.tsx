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

export function StudentSearchScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const base = useBasePath();
  const { stats } = useDashboardStats();
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (term: string) => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchStudents({ q: term, pageSize: 25 });
      setStudents(page.students);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load students.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(query);
  }, [load, query]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchStudents({ q: query, cursor: cursor ?? "", pageSize: 25 });
      setStudents((prev) => [
        ...prev,
        ...page.students.filter((item) => !prev.some((existing) => existing.id === item.id))
      ]);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch {
      // Keep the current page; the user can search again.
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, hasMore, loading, loadingMore, query]);

  const sections = useMemo(() => {
    const byClass = new Map<string, StudentRecord[]>();
    for (const student of students) {
      const key = formatText(student.class, "Unassigned");
      byClass.set(key, [...(byClass.get(key) ?? []), student]);
    }
    return [...byClass.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([className, data]) => ({
        title: `CLASS ${className.toUpperCase()} · ${data.length}`,
        data
      }));
  }, [students]);

  const submitSearch = () => setQuery(queryInput.trim());

  return (
    <SectionList
      sections={sections}
      keyExtractor={(student) => student.id}
      renderItem={({ item: student }) => (
        <ListRow
          leading={<Avatar label={initials(student.studentName ?? "?")} size={40} />}
          title={formatText(student.studentName, "Student")}
          subtitle={`${formatText(student.admissionNumber ?? student.admissionNo)} · ${formatText(student.fatherName, "Parent not recorded")}`}
          trailing={
            student.totalFeesDue && student.totalFeesDue > 0 ? (
              <DSText variant="caption" tint={t.bad}>{formatMoneyShort(student.totalFeesDue)} due</DSText>
            ) : (
              <Badge label="Paid" bg={t.okBg} fg={t.ok} />
            )
          }
          chevron
          onPress={() => router.push(`${base}/student/${student.id}` as never)}
        />
      )}
      renderSectionHeader={({ section }) => (
        <DSText variant="overline" style={styles.sectionTitle}>{section.title}</DSText>
      )}
      ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: t.line }]} />}
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load(query)} tintColor={t.blue} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <ScreenBack />
          <PageTitle>Students</PageTitle>
          <DSText variant="label">
            {stats ? `${stats.totalStudents} students on roll` : "Search by name, admission number or phone."}
          </DSText>
          <View style={styles.searchRow}>
            <View style={{ flex: 1 }}>
              <TextField
                value={queryInput}
                onChangeText={setQueryInput}
                placeholder="Name, admission no. or phone"
                icon={<Icon name="search" size={18} tint={t.mute} />}
                returnKeyType="search"
                onSubmitEditing={submitSearch}
                accessibilityLabel="Search students"
              />
            </View>
            <PillButton label="Search" onPress={submitSearch} />
          </View>
          {query ? (
            <PressableScale
              accessibilityLabel="Clear search"
              onPress={() => { setQueryInput(""); setQuery(""); }}
              style={styles.clearSearch}
            >
              <DSText variant="label" tint={t.blue}>Clear search · {query}</DSText>
            </PressableScale>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        loading ? null : error ? (
          <ErrorState message={error} onRetry={() => void load(query)} />
        ) : (
          <EmptyState icon="school" label={query ? `No students match “${query}”.` : "No students found."} />
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
