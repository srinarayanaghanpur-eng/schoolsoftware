/**
 * Shared management screens for the flows added in this release:
 * receipts, student search/detail, dues and staff detail.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, RefreshControl, ScrollView, SectionList, StyleSheet, View
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
  fetchDues, fetchReceipt, fetchStudent, fetchStudentPayments, fetchStudents,
  fetchTeacher, fetchTeacherAttendanceSummary,
  type AdminPayment, type AdminTeacherDetail, type DueStudent, type ReceiptRecord,
  type StudentRecord, type TeacherAttendanceSummary
} from "./api";
import { formatDate, formatMoney, formatMoneyShort, formatText, useDashboardStats } from "./hooks";

function formatDateTime(value?: unknown) {
  const text = typeof value === "string" ? value : asDateString(value, "");
  if (!text) return "—";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function useBasePath() {
  const { profile } = useMobileSession();
  return dashboardPathForRole(profile?.role);
}

function ScreenBack() {
  const { t } = useTheme();
  const router = useRouter();
  return (
    <PressableScale
      accessibilityLabel="Go back"
      onPress={() => router.back()}
      style={styles.back}
    >
      <Icon name="arrow-back" size={18} tint={t.blue} />
      <DSText variant="bodyMedium" tint={t.blue}>Back</DSText>
    </PressableScale>
  );
}

/* --------------------------------------------------------------- Receipt */

export function ReceiptDetailScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const base = useBasePath();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const receiptId = Array.isArray(params.id) ? params.id[0] : params.id ?? "";
  const [receipt, setReceipt] = useState<ReceiptRecord | null>(null);
  const [history, setHistory] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!receiptId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchReceipt(receiptId);
      setReceipt(result.receipt);
      if (result.receipt.studentId) {
        const payments = await fetchStudentPayments(result.receipt.studentId, 20);
        setHistory(payments);
      } else {
        setHistory([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load receipt.");
    } finally {
      setLoading(false);
    }
  }, [receiptId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !receipt) return <SkeletonPage />;
  if (error && !receipt) return <ErrorState message={error} onRetry={load} />;
  if (!receipt) return <EmptyState icon="receipt-long" label="Receipt not found." />;

  const allFeeItems = receipt.feeItems ?? [];
  const chargedFeeItems = allFeeItems.filter((item) => Number(item.amount ?? 0) > 0);
  const feeItems = chargedFeeItems.length > 0 ? chargedFeeItems : allFeeItems.slice(0, 4);
  const currentPaymentId = receipt.paymentId ?? receiptId;

  return (
    <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <ScreenBack />
      <PageTitle>Receipt</PageTitle>

      <Card style={styles.receiptHero}>
        <View style={styles.receiptHeroTop}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <DSText variant="overline">RECEIPT NUMBER</DSText>
            <DSText variant="title" style={styles.receiptNo}>{receipt.receiptNo ?? receipt.id ?? "—"}</DSText>
            <DSText variant="label">{formatDateTime(receipt.paymentDate)}</DSText>
          </View>
          <Badge
            label={formatText(receipt.status, "Issued")}
            bg={t.okBg}
            fg={t.ok}
          />
        </View>
        <View style={[styles.divider, { backgroundColor: t.line }]} />
        <View style={styles.receiptAmountRow}>
          <DSText variant="label">Amount paid</DSText>
          <DSText variant="display" tint={t.ok} style={styles.receiptAmount}>
            {formatMoney(receipt.totalPaid)}
          </DSText>
        </View>
        <DSText variant="label">
          Balance after payment · {formatMoney(receipt.balanceDue)}
        </DSText>
      </Card>

      <SectionCard heading="STUDENT">
        <ListRow
          leading={<Avatar label={initials(receipt.studentName ?? "?")} size={42} />}
          title={formatText(receipt.studentName, "Student")}
          subtitle={`${formatText(receipt.admissionNo)} · Class ${formatText(receipt.className)}${receipt.section ? ` ${receipt.section}` : ""}`}
        />
        <View style={[styles.divider, { backgroundColor: t.line }]} />
        <ListRow
          leading={<TonalTile bg={t.tint}><Icon name="person-outline" size={19} tint={t.blue} /></TonalTile>}
          title={formatText(receipt.parentName, "Parent")}
          subtitle={formatText(receipt.mobile, "Mobile not recorded")}
        />
      </SectionCard>

      <SectionCard heading="PAYMENT">
        <ListRow
          leading={<TonalTile bg={t.okBg}><Icon name="payments" size={19} tint={t.ok} /></TonalTile>}
          title={formatText(receipt.paymentMode, "Payment")}
          subtitle={`Academic year ${formatText(receipt.academicYear)}`}
        />
        <View style={[styles.divider, { backgroundColor: t.line }]} />
        <ListRow
          leading={<TonalTile bg={t.tint}><Icon name="badge" size={19} tint={t.blue} /></TonalTile>}
          title={formatText(receipt.createdByUsername, "School office")}
          subtitle="Recorded by"
        />
      </SectionCard>

      <SectionCard heading="FEE ITEMS">
        {feeItems.length === 0 ? (
          <DSText variant="label">No itemised heads on this receipt.</DSText>
        ) : (
          feeItems.map((item, index) => {
            const label = formatText(
              item.name ?? item.label ?? item.type ?? item.description,
              "Fee"
            ).replace(/_/g, " ");
            return (
              <View key={`${index}-${label}`}>
                {index > 0 ? <View style={[styles.divider, { backgroundColor: t.line }]} /> : null}
                <ListRow
                  leading={<TonalTile bg={t.tint}><Icon name="receipt" size={19} tint={t.blue} /></TonalTile>}
                  title={label.replace(/\b\w/g, (char) => char.toUpperCase())}
                  subtitle={formatText(item.periodOrMonth ?? item.remarks ?? item.description, "")}
                  trailing={<DSText variant="bodyMedium">{formatMoney(item.amount)}</DSText>}
                />
              </View>
            );
          })
        )}
      </SectionCard>

      <SectionCard heading={`PAYMENT HISTORY · ${history.length}`}>
        {history.length === 0 ? (
          <DSText variant="label">No other payments recorded for this student.</DSText>
        ) : (
          history.map((payment, index) => (
            <View key={payment.id}>
              {index > 0 ? <View style={[styles.divider, { backgroundColor: t.line }]} /> : null}
              <ListRow
                leading={<TonalTile bg={t.okBg}><Icon name="check" size={19} tint={t.ok} /></TonalTile>}
                title={formatMoney(payment.amountPaid)}
                subtitle={`${formatText(payment.paymentType ?? payment.feeType, "Fee")} · ${formatText(payment.paymentMethod)} · ${formatDate(payment.paymentDate ?? payment.createdAt)}`}
                chevron={payment.id !== currentPaymentId}
                onPress={payment.id !== currentPaymentId ? () => router.push(`${base}/receipt/${payment.id}` as never) : undefined}
              />
            </View>
          ))
        )}
      </SectionCard>
    </ScrollView>
  );
}

/* --------------------------------------------------------------- Students */

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

export function StudentDetailScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const base = useBasePath();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const studentId = Array.isArray(params.id) ? params.id[0] : params.id ?? "";
  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    try {
      const record = await fetchStudent(studentId);
      setStudent(record);
      const history = await fetchStudentPayments(studentId, 20);
      setPayments(history);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load student.");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !student) return <SkeletonPage />;
  if (error && !student) return <ErrorState message={error} onRetry={load} />;
  if (!student) return <EmptyState icon="person-off" label="Student not found." />;

  const due = Number(student.totalFeesDue ?? 0);

  return (
    <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <ScreenBack />
      <View style={styles.identityRow}>
        <Avatar label={initials(student.studentName ?? "?")} size={58} bg={t.blue} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <DSText variant="title" numberOfLines={1}>{formatText(student.studentName, "Student")}</DSText>
          <DSText variant="label">
            {formatText(student.admissionNumber ?? student.admissionNo)} · Class {formatText(student.class)}
            {student.section ? ` ${student.section}` : ""}
          </DSText>
          <Badge
            label={due > 0 ? "Dues pending" : "Fees paid"}
            bg={due > 0 ? t.badBg : t.okBg}
            fg={due > 0 ? t.bad : t.ok}
          />
        </View>
      </View>

      <View style={styles.statRow}>
        <Card style={styles.moneyCard}>
          <TonalTile bg={t.tint} size={34}>
            <Icon name="payments" size={18} tint={t.blue} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>{formatMoneyShort(student.totalFeeAmount)}</DSText>
          <DSText variant="overline" style={styles.moneyLabel}>TOTAL FEE</DSText>
        </Card>
        <Card style={styles.moneyCard}>
          <TonalTile bg={t.okBg} size={34}>
            <Icon name="check-circle" size={18} tint={t.ok} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>{formatMoneyShort(student.totalFeesPaid)}</DSText>
          <DSText variant="overline" style={styles.moneyLabel}>PAID</DSText>
        </Card>
        <Card style={styles.moneyCard}>
          <TonalTile bg={due > 0 ? t.badBg : t.okBg} size={34}>
            <Icon name={due > 0 ? "error-outline" : "check"} size={18} tint={due > 0 ? t.bad : t.ok} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>{formatMoneyShort(student.totalFeesDue)}</DSText>
          <DSText variant="overline" style={styles.moneyLabel}>DUE</DSText>
        </Card>
      </View>

      <SectionCard heading="STUDENT DETAILS">
        <ListRow
          leading={<TonalTile bg={t.tint}><Icon name="badge" size={19} tint={t.blue} /></TonalTile>}
          title={formatText(student.admissionNumber ?? student.admissionNo)}
          subtitle="Admission number"
        />
        <View style={[styles.divider, { backgroundColor: t.line }]} />
        <ListRow
          leading={<TonalTile bg={t.tint}><Icon name="wc" size={19} tint={t.blue} /></TonalTile>}
          title={formatText(student.gender, "Not recorded")}
          subtitle={`Date of birth · ${formatDate(student.dateOfBirth)}`}
        />
        <View style={[styles.divider, { backgroundColor: t.line }]} />
        <ListRow
          leading={<TonalTile bg={t.tint}><Icon name="person-outline" size={19} tint={t.blue} /></TonalTile>}
          title={formatText(student.fatherName, "Father not recorded")}
          subtitle={`Mother · ${formatText(student.motherName, "—")}`}
        />
        <View style={[styles.divider, { backgroundColor: t.line }]} />
        <ListRow
          leading={<TonalTile bg={t.tint}><Icon name="call" size={19} tint={t.blue} /></TonalTile>}
          title={formatText(student.phone ?? student.fatherPhone, "No phone")}
          subtitle={`Other number · ${formatText(student.motherPhone, "—")}`}
        />
        <View style={[styles.divider, { backgroundColor: t.line }]} />
        <ListRow
          leading={<TonalTile bg={t.tint}><Icon name="home" size={19} tint={t.blue} /></TonalTile>}
          title={formatText(student.address, "Address not recorded")}
          subtitle="Address"
        />
      </SectionCard>

      <SectionCard heading="FEE SUMMARY">
        <ListRow title={formatMoney(student.totalFeeAmount)} subtitle="Committed total fee" />
        <View style={[styles.divider, { backgroundColor: t.line }]} />
        <ListRow title={formatMoney(student.totalFeesPaid)} subtitle="Paid to date" />
        <View style={[styles.divider, { backgroundColor: t.line }]} />
        <ListRow title={formatMoney(student.totalConcessionAmount)} subtitle="Concession" />
        <View style={[styles.divider, { backgroundColor: t.line }]} />
        <ListRow
          title={formatMoney(student.totalFeesDue)}
          subtitle="Outstanding due"
          trailing={<Badge label={formatText(student.feeStatus, "pending")} bg={due > 0 ? t.badBg : t.okBg} fg={due > 0 ? t.bad : t.ok} />}
        />
      </SectionCard>

      <SectionCard heading={`PAYMENT HISTORY · ${payments.length}`}>
        {payments.length === 0 ? (
          <DSText variant="label">No payments recorded yet.</DSText>
        ) : (
          payments.map((payment, index) => (
            <View key={payment.id}>
              {index > 0 ? <View style={[styles.divider, { backgroundColor: t.line }]} /> : null}
              <ListRow
                leading={<TonalTile bg={t.okBg}><Icon name="receipt" size={19} tint={t.ok} /></TonalTile>}
                title={formatMoney(payment.amountPaid)}
                subtitle={`${formatText(payment.paymentType ?? payment.feeType, "Fee")} · ${formatText(payment.paymentMethod)} · ${formatDate(payment.paymentDate ?? payment.createdAt)}`}
                chevron
                onPress={() => router.push(`${base}/receipt/${payment.id}` as never)}
              />
            </View>
          ))
        )}
      </SectionCard>
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ Dues */

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

export function StaffDetailScreen() {
  const { t } = useTheme();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const teacherId = Array.isArray(params.id) ? params.id[0] : params.id ?? "";
  const [teacher, setTeacher] = useState<AdminTeacherDetail | null>(null);
  const [attendance, setAttendance] = useState<TeacherAttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!teacherId) return;
    setLoading(true);
    setError(null);
    try {
      const [record, summary] = await Promise.all([
        fetchTeacher(teacherId),
        fetchTeacherAttendanceSummary(teacherId).catch(() => null)
      ]);
      setTeacher(record);
      setAttendance(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load staff details.");
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !teacher) return <SkeletonPage />;
  if (error && !teacher) return <ErrorState message={error} onRetry={load} />;
  if (!teacher) return <EmptyState icon="groups" label="Staff member not found." />;

  const status = teacher.status ?? "active";
  const rate = attendance && attendance.workingDays > 0
    ? ((attendance.present + attendance.late) / attendance.workingDays) * 100
    : 0;

  return (
    <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <ScreenBack />
      <View style={styles.identityRow}>
        <Avatar label={initials(teacher.fullName ?? "?")} size={58} bg={t.blue} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <DSText variant="title" numberOfLines={1}>{formatText(teacher.fullName, "Staff member")}</DSText>
          <DSText variant="label">
            {formatText(teacher.subject, "Staff")} · {formatText(teacher.employeeId)}
          </DSText>
          <Badge
            label={status === "active" ? "Active" : "Inactive"}
            bg={status === "active" ? t.okBg : t.line}
            fg={status === "active" ? t.ok : t.mute}
          />
        </View>
      </View>

      <View style={styles.statRow}>
        <Card style={styles.moneyCard}>
          <TonalTile bg={t.tint} size={34}>
            <Icon name="payments" size={18} tint={t.blue} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>{formatMoneyShort(teacher.baseSalary)}</DSText>
          <DSText variant="overline" style={styles.moneyLabel}>BASE SALARY</DSText>
        </Card>
        <Card style={styles.moneyCard}>
          <TonalTile bg={t.okBg} size={34}>
            <Icon name="how-to-reg" size={18} tint={t.ok} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>{attendance?.present ?? 0}</DSText>
          <DSText variant="overline" style={styles.moneyLabel}>PRESENT</DSText>
        </Card>
        <Card style={styles.moneyCard}>
          <TonalTile bg={t.badBg} size={34}>
            <Icon name="person-off" size={18} tint={t.bad} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>{attendance?.absent ?? 0}</DSText>
          <DSText variant="overline" style={styles.moneyLabel}>ABSENT</DSText>
        </Card>
      </View>

      <SectionCard heading="SALARY & EMPLOYMENT">
        <ListRow
          leading={<TonalTile bg={t.okBg}><Icon name="account-balance" size={19} tint={t.ok} /></TonalTile>}
          title={formatMoney(teacher.baseSalary)}
          subtitle="Monthly base salary"
        />
        <View style={[styles.divider, { backgroundColor: t.line }]} />
        <ListRow
          leading={<TonalTile bg={t.tint}><Icon name="event" size={19} tint={t.blue} /></TonalTile>}
          title={formatDate(teacher.joiningDate)}
          subtitle="Joining date"
        />
        <View style={[styles.divider, { backgroundColor: t.line }]} />
        <ListRow
          leading={<TonalTile bg={t.tint}><Icon name="work" size={19} tint={t.blue} /></TonalTile>}
          title={formatText(teacher.employmentType, "Full time")}
          subtitle="Employment type"
        />
        <View style={[styles.divider, { backgroundColor: t.line }]} />
        <ListRow
          leading={<TonalTile bg={t.tint}><Icon name="call" size={19} tint={t.blue} /></TonalTile>}
          title={formatText(teacher.phone, "No phone")}
          subtitle="Contact number"
        />
      </SectionCard>

      <SectionCard heading={`ATTENDANCE · ${attendance?.month ?? "THIS MONTH"}`}>
        {attendance ? (
          <>
            <ListRow
              title={`${attendance.present} present · ${attendance.late} late`}
              subtitle={`${attendance.absent} absent of ${attendance.workingDays} working days`}
            />
            <View style={[styles.divider, { backgroundColor: t.line }]} />
            <View style={{ gap: space.xs, paddingVertical: space.xs }}>
              <DSText variant="label">Attendance rate · {Math.round(rate)}%</DSText>
              <View style={[styles.progressTrack, { backgroundColor: t.line }]}>
                <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, rate))}%`, backgroundColor: rate >= 90 ? t.ok : t.warn }]} />
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: t.line }]} />
            {attendance.records.length === 0 ? (
              <DSText variant="label">No attendance records this month.</DSText>
            ) : (
              attendance.records.slice(0, 12).map((record, index) => (
                <View key={record.date}>
                  {index > 0 ? <View style={[styles.divider, { backgroundColor: t.line }]} /> : null}
                  <ListRow
                    leading={
                      <TonalTile bg={record.status === "late" ? t.warnBg : record.status === "absent" ? t.badBg : t.okBg}>
                        <Icon name={record.status === "late" ? "schedule" : record.status === "absent" ? "person-off" : "check"} size={19} tint={record.status === "late" ? t.warn : record.status === "absent" ? t.bad : t.ok} />
                      </TonalTile>
                    }
                    title={formatDate(record.date)}
                    subtitle={`${formatText(record.status)}${record.checkInTime ? ` · in ${record.checkInTime}` : ""}${record.checkOutTime ? ` · out ${record.checkOutTime}` : ""}`}
                  />
                </View>
              ))
            )}
          </>
        ) : (
          <DSText variant="label">Attendance summary is unavailable right now.</DSText>
        )}
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, paddingTop: space.md, gap: 14 },
  header: { gap: 14 },
  back: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start", paddingVertical: 2 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 56 },
  sectionTitle: { marginTop: space.sm },
  divider: { height: StyleSheet.hairlineWidth },
  statRow: { flexDirection: "row", gap: 10 },
  moneyCard: {
    flex: 1,
    padding: space.md,
    paddingHorizontal: space.sm,
    alignItems: "flex-start",
    gap: 6,
    borderRadius: radius.lg
  },
  moneyValue: { fontSize: 17, fontWeight: "800" },
  moneyLabel: { fontSize: 10 },
  identityRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 6 },
  receiptHero: { gap: space.sm },
  receiptHeroTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  receiptNo: { fontSize: 20 },
  receiptAmountRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  receiptAmount: { fontSize: 24, fontWeight: "800" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  clearSearch: { alignSelf: "flex-start", paddingVertical: 2 },
  dueSectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: space.sm },
  loadMore: { paddingVertical: space.md, alignItems: "center" },
  progressTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4 }
});
