/**
 * Shared management screens.
 *
 * Admin and Principal see the same staff / approvals / profile surfaces; the
 * only difference is the surrounding shell and its tab set. Keeping the bodies
 * here means one implementation instead of two drifting copies.
 */
import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, SectionList, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Avatar, Badge, BottomSheet, Card, DSText, EmptyState, ErrorState, FilterChips, Icon, ListRow,
  SkeletonPage, PageTitle, PillButton, PressableScale, ProgressRow, SectionCard, TextField, TonalTile, useToast,
  type IconName
} from "@/design-system/components";
import { radius, space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import { useMobileSession } from "@/lib/mobileSession";
import { dashboardPathForRole, workspaceForRole, workspaceLabel } from "@/lib/roleRouting";
import { displayLoginContact } from "@/lib/text";
import { openWebsite } from "@/lib/openWebsite";
import { ROLE_LABELS } from "@sri-narayana/shared";
import { initials } from "@/features/teacher/hooks";
import { assignTask, decideChangeRequest, fetchVouchersByCategory, fetchVouchersByIds, reviewLeaveRequest, updateTaskStatus } from "./api";
import type { AdminTeacher, DebitVoucher, Expense, StaffDriver, StaffOffice } from "./api";
import {
  formatDate, formatMoney, formatMoneyShort, formatText, useCashBook,
  useChangeRequests, useDashboardStats, useExams, useExpenses, useLeaveRequests,
  useStaffDirectory, useTasks, useTodayAttendance
} from "./hooks";

/* ------------------------------------------------------------------ Staff */

const STAFF_FILTERS = ["All", "Active", "Inactive"];

export function StaffScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const { profile } = useMobileSession();
  const [filter, setFilter] = useState("All");
  const { teachers, drivers, office, loading, error, refresh } = useStaffDirectory();
  const attendance = useTodayAttendance();
  const assignHref =
    workspaceForRole(profile?.role) === "principal" ? "/principal/tasks" : "/admin/tasks";

  const visibleTeachers = useMemo(() => {
    if (filter === "All") return teachers;
    const wanted = filter.toLowerCase();
    return teachers.filter((member) => (member.status ?? "active").toLowerCase() === wanted);
  }, [teachers, filter]);

  const sections = useMemo(() => {
    const list: {
      title: string;
      kind: "teacher" | "driver" | "office";
      data: (AdminTeacher | StaffDriver | StaffOffice)[];
    }[] = [];
    if (visibleTeachers.length > 0) {
      list.push({ title: `TEACHERS · ${visibleTeachers.length}`, kind: "teacher", data: visibleTeachers });
    }
    if (drivers.length > 0) {
      list.push({ title: `DRIVERS · ${drivers.length}`, kind: "driver", data: drivers });
    }
    if (office.length > 0) {
      list.push({ title: `OFFICE & SUPPORT · ${office.length}`, kind: "office", data: office });
    }
    return list;
  }, [visibleTeachers, drivers, office]);

  if (loading && teachers.length === 0) return <SkeletonPage />;
  if (error && teachers.length === 0) return <ErrorState message={error} onRetry={refresh} />;

  const attendanceRate = attendance.total > 0 ? (attendance.present / attendance.total) * 100 : 0;

  // Virtualized sections: teachers, drivers, office & support staff.
  return (
    <SectionList
      sections={sections}
      keyExtractor={(member) => member.id}
      renderItem={({ item, section }) => {
        if (section.kind === "driver") {
          const driver = item as StaffDriver;
          const vehicle = driver.vehicleNo ?? driver.vehicle ?? "";
          return (
            <ListRow
              leading={<Avatar label={initials(driver.name ?? "?")} size={40} />}
              title={driver.name ?? "Driver"}
              subtitle={`${vehicle || "—"}${driver.licenseNo ? ` · ${driver.licenseNo}` : ""}${driver.phone ?? driver.mobile ? ` · ${driver.phone ?? driver.mobile}` : ""}`}
            />
          );
        }
        if (section.kind === "office") {
          const member = item as StaffOffice;
          const roleKey = (member.role ?? "") as keyof typeof ROLE_LABELS;
          return (
            <ListRow
              leading={<Avatar label={initials(member.displayName ?? "?")} size={40} />}
              title={member.displayName ?? "Staff member"}
              subtitle={`${ROLE_LABELS[roleKey] ?? member.role ?? "Staff"}${member.email ? ` · ${member.email}` : ""}`}
            />
          );
        }
        const teacherMember = item as AdminTeacher;
        return (
          <ListRow
            leading={<Avatar label={initials(teacherMember.fullName ?? "?")} size={40} />}
            title={teacherMember.fullName ?? "Unnamed"}
            subtitle={`${teacherMember.subject ?? "—"}${teacherMember.employeeId ? ` · ${teacherMember.employeeId}` : ""}`}
            trailing={
              <Badge
                label={(teacherMember.status ?? "active") === "active" ? "Active" : "Inactive"}
                bg={(teacherMember.status ?? "active") === "active" ? t.okBg : t.line}
                fg={(teacherMember.status ?? "active") === "active" ? t.ok : t.mute}
              />
            }
          />
        );
      }}
      renderSectionHeader={({ section }) => (
        <DSText variant="overline" style={styles.sectionTitle}>{section.title}</DSText>
      )}
      ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: t.line }]} />}
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={t.blue} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <PageTitle>Staff</PageTitle>

          <View style={styles.moneyGrid}>
            <View style={styles.moneyRow}>
              <Card style={styles.moneyCard}>
                <TonalTile bg={t.okBg} size={34}>
                  <Icon name="how-to-reg" size={18} tint={t.ok} />
                </TonalTile>
                <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
                  {attendance.present}
                </DSText>
                <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>PRESENT</DSText>
              </Card>
              <Card style={styles.moneyCard}>
                <TonalTile bg={t.warnBg} size={34}>
                  <Icon name="schedule" size={18} tint={t.warn} />
                </TonalTile>
                <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
                  {attendance.late}
                </DSText>
                <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>LATE</DSText>
              </Card>
            </View>
            <View style={styles.moneyRow}>
              <Card style={styles.moneyCard}>
                <TonalTile bg={t.badBg} size={34}>
                  <Icon name="person-off" size={18} tint={t.bad} />
                </TonalTile>
                <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
                  {attendance.absent}
                </DSText>
                <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>ABSENT</DSText>
              </Card>
              <Card style={styles.moneyCard}>
                <TonalTile bg={t.tint} size={34}>
                  <Icon name="groups" size={18} tint={t.blue} />
                </TonalTile>
                <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
                  {teachers.length}
                </DSText>
                <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>ON ROLL</DSText>
              </Card>
            </View>
          </View>

          <SectionCard heading="TODAY’S ATTENDANCE">
            <ProgressRow
              label="Staff present"
              percent={attendanceRate}
              valueLabel={`${attendance.present} / ${attendance.total}`}
              tint={attendanceRate >= 90 ? t.ok : t.warn}
            />
          </SectionCard>

          <FilterChips options={STAFF_FILTERS} value={filter} onChange={setFilter} />

          <PillButton
            label="Assign task"
            block
            bg={t.blue}
            fg="#FFFFFF"
            icon="add-task"
            onPress={() => router.push(assignHref as never)}
          />

          <DSText variant="label" tint={t.mute}>Filter applies to teachers.</DSText>
        </View>
      }
      ListEmptyComponent={
        <EmptyState icon="groups" label={`No ${filter.toLowerCase()} staff to show.`} />
      }
      initialNumToRender={15}
      maxToRenderPerBatch={15}
      windowSize={7}
      removeClippedSubviews={true}
    />
  );
}

/* -------------------------------------------------------------- Approvals */

const APPROVAL_FILTERS = ["Pending", "Approved", "Rejected"];

export function ApprovalsScreen() {
  const { t } = useTheme();
  const toast = useToast();
  const [tab, setTab] = useState("Leave");
  const [filter, setFilter] = useState("Pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyChangeId, setBusyChangeId] = useState<string | null>(null);
  const { requests, loading, error, refresh } = useLeaveRequests();
  const {
    changes, loading: changesLoading, error: changesError, refresh: refreshChanges
  } = useChangeRequests(filter.toLowerCase());

  const visible = useMemo(
    () => requests.filter((request) => (request.status ?? "pending") === filter.toLowerCase()),
    [requests, filter]
  );

  async function decide(requestId: string, status: "approved" | "rejected") {
    setBusyId(requestId);
    try {
      await reviewLeaveRequest(requestId, status);
      toast.show(status === "approved" ? "Leave approved ✓" : "Leave rejected");
      refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn’t update the request.");
    } finally {
      setBusyId(null);
    }
  }

  async function decideChange(changeId: string, status: "approved" | "rejected") {
    setBusyChangeId(changeId);
    try {
      await decideChangeRequest(changeId, status);
      toast.show(status === "approved" ? "Change applied ✓" : "Change rejected");
      refreshChanges();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn’t update the request.");
    } finally {
      setBusyChangeId(null);
    }
  }

  const showLeave = tab === "Leave";

  if (showLeave) {
    if (loading && requests.length === 0) return <SkeletonPage />;
    if (error && requests.length === 0) return <ErrorState message={error} onRetry={refresh} />;
  } else {
    if (changesLoading && changes.length === 0) return <SkeletonPage />;
    if (changesError && changes.length === 0) {
      return <ErrorState message={changesError} onRetry={refreshChanges} />;
    }
  }

  const changeLabel = (entity: string) => entity.replace(/_/g, " ").toUpperCase();
  const patchLines = (patch?: Record<string, unknown>) =>
    Object.entries(patch ?? {}).slice(0, 5).map(([key, value]) => (
      `${key}: ${Array.isArray(value) ? `${value.length} items` : formatText(value)}`
    ));
  const emptyLabel = !showLeave
    ? `No ${filter.toLowerCase()} change requests.`
    : filter === "Pending"
      ? "Nothing waiting on you. All caught up."
      : `No ${filter.toLowerCase()} requests.`;

  return (
    <FlatList
      data={showLeave ? visible : changes}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        if (showLeave) {
          const request = item as (typeof visible)[number];
          return (
            <SectionCard
              heading={(request.leaveType ?? "LEAVE").toUpperCase()}
              trailing={<DSText variant="caption">{formatDate(request.requestedAt)}</DSText>}
            >
              <ListRow
                leading={<Avatar label={initials(request.teacherName ?? "?")} size={40} />}
                title={request.teacherName ?? "Staff member"}
                subtitle={`${formatDate(request.fromDate)} – ${formatDate(request.toDate)}`}
              />
              {request.reason ? (
                <DSText variant="body" style={{ marginTop: space.xs }}>{request.reason}</DSText>
              ) : null}

              {filter === "Pending" ? (
                <View style={styles.decisionRow}>
                  <View style={{ flex: 1 }}>
                    <PillButton
                      label={busyId === request.id ? "Saving…" : "Approve"}
                      block
                      icon="check"
                      bg={t.blue}
                      fg="#FFFFFF"
                      onPress={() => { if (!busyId) void decide(request.id, "approved"); }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PillButton
                      label="Reject"
                      block
                      icon="close"
                      bg={t.badBg}
                      fg={t.bad}
                      onPress={() => { if (!busyId) void decide(request.id, "rejected"); }}
                    />
                  </View>
                </View>
              ) : null}
            </SectionCard>
          );
        }
        const change = item as (typeof changes)[number];
        const lines = patchLines(change.patch);
        return (
          <SectionCard
            heading={`${change.action.toUpperCase()} · ${changeLabel(change.entity)}`}
            trailing={<DSText variant="caption">{formatDate(change.createdAt)}</DSText>}
          >
            <ListRow
              leading={<Avatar label={initials(change.requestedByName ?? "?")} size={40} />}
              title={change.requestedByName ?? "Staff member"}
              subtitle={change.note ? change.note : `Item ${change.entityId.slice(0, 8)}…`}
            />
            {change.action === "edit" && lines.length > 0 ? (
              <View style={{ marginTop: space.xs, gap: 2 }}>
                {lines.map((line) => (
                  <DSText key={line} variant="label" tint={t.mute} numberOfLines={1}>{line}</DSText>
                ))}
              </View>
            ) : null}
            {filter === "Pending" ? (
              <View style={styles.decisionRow}>
                <View style={{ flex: 1 }}>
                  <PillButton
                    label={busyChangeId === change.id ? "Saving…" : "Approve"}
                    block
                    icon="check"
                    bg={t.blue}
                    fg="#FFFFFF"
                    onPress={() => { if (!busyChangeId) void decideChange(change.id, "approved"); }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <PillButton
                    label="Reject"
                    block
                    icon="close"
                    bg={t.badBg}
                    fg={t.bad}
                    onPress={() => { if (!busyChangeId) void decideChange(change.id, "rejected"); }}
                  />
                </View>
              </View>
            ) : null}
          </SectionCard>
        );
      }}
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={showLeave ? loading : changesLoading}
          onRefresh={() => { refresh(); refreshChanges(); }}
          tintColor={t.blue}
        />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <PageTitle>Approvals</PageTitle>
          <FilterChips options={["Leave", "Changes"]} value={tab} onChange={setTab} />
          <FilterChips options={APPROVAL_FILTERS} value={filter} onChange={setFilter} />
        </View>
      }
      ListEmptyComponent={
        <SectionCard heading={filter.toUpperCase()}>
          <EmptyState icon="fact-check" label={emptyLabel} />
        </SectionCard>
      }
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={7}
      removeClippedSubviews={true}
    />
  );
}

/* ----------------------------------------------------------------- Exams */

export function ExamsScreen() {
  const { t } = useTheme();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { exams, loading, error, refresh } = useExams();

  if (loading && exams.length === 0) return <SkeletonPage />;
  if (error && exams.length === 0) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <FlatList
      data={exams}
      keyExtractor={(exam) => exam.id}
      renderItem={({ item: exam }) => {
        const expanded = expandedId === exam.id;
        const papers = exam.timetable ?? [];
        return (
          <SectionCard
            heading={((exam.examType ?? exam.name ?? "EXAM") as string).toUpperCase()}
            trailing={
              <DSText variant="caption">
                {[exam.startDate, exam.endDate].filter(Boolean).join(" – ") || ""}
              </DSText>
            }
          >
            <ListRow
              leading={
                <TonalTile bg={t.tint}>
                  <Icon name="school" size={19} tint={t.blue} />
                </TonalTile>
              }
              title={exam.name ?? "Exam"}
              subtitle={`Class ${exam.className ?? "—"}${exam.section ? ` ${exam.section}` : ""} · ${papers.length} paper${papers.length === 1 ? "" : "s"}`}
              chevron
              onPress={() => setExpandedId(expanded ? null : exam.id)}
            />
            {expanded ? (
              <View style={{ marginTop: space.sm, gap: space.xs }}>
                {papers.length === 0 ? (
                  <DSText variant="label" tint={t.mute}>Timetable not published yet.</DSText>
                ) : (
                  papers.map((paper, index) => (
                    <View
                      key={`${paper.subject ?? index}-${paper.date ?? index}`}
                      style={[styles.examPaper, { borderColor: t.line }]}
                    >
                      <DSText variant="bodyMedium" style={{ flex: 1 }}>{paper.subject ?? "—"}</DSText>
                      <DSText variant="caption">{paper.date ?? ""}{paper.time ? ` · ${paper.time}` : ""}</DSText>
                    </View>
                  ))
                )}
              </View>
            ) : null}
          </SectionCard>
        );
      }}
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={t.blue} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <PageTitle>Exams</PageTitle>
        </View>
      }
      ListEmptyComponent={
        <EmptyState icon="school" label="No exams scheduled yet." />
      }
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={7}
      removeClippedSubviews={true}
    />
  );
}

/* --------------------------------------------------------------- Expenses */

export function ExpensesScreen() {
  const { t } = useTheme();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<Record<string, DebitVoucher[] | null>>({});
  const { expenses, loading, loadingMore, hasMore, error, refresh, loadMore } = useExpenses();
  const { entries, closingBalance, refresh: refreshBook } = useCashBook();

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const entry of entries) {
      if (entry.type === "income") income += Number(entry.amount ?? 0);
      else if (entry.type === "expense") expense += Number(entry.amount ?? 0);
    }
    return { income, expense };
  }, [entries]);

  if (loading && expenses.length === 0) return <SkeletonPage />;
  if (error && expenses.length === 0) return <ErrorState message={error} onRetry={refresh} />;

  const toggle = (expense: Expense) => {
    if (expandedId === expense.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(expense.id);
    if (receipts[expense.id] !== undefined) return;
    setReceipts((prev) => ({ ...prev, [expense.id]: null }));
    void (async () => {
      try {
        const [linked, similar] = await Promise.all([
          expense.voucherId ? fetchVouchersByIds([expense.voucherId]) : Promise.resolve([]),
          expense.category ? fetchVouchersByCategory(expense.category, 3) : Promise.resolve([])
        ]);
        const merged = [...linked, ...similar.filter((s) => !linked.some((l) => l.id === s.id))].slice(0, 4);
        setReceipts((prev) => ({ ...prev, [expense.id]: merged }));
      } catch {
        setReceipts((prev) => ({ ...prev, [expense.id]: [] }));
      }
    })();
  };

  const voucherLine = (voucher: DebitVoucher) =>
    `${voucher.voucherNo ? `#${voucher.voucherNo} · ` : ""}${voucher.paidTo ?? "—"}`;

  return (
    <FlatList
      data={expenses}
      keyExtractor={(expense) => expense.id}
      renderItem={({ item: expense }) => {
        const expanded = expandedId === expense.id;
        const found = receipts[expense.id];
        return (
          <View>
            <ListRow
              leading={
                <TonalTile bg={t.badBg}>
                  <Icon name="receipt" size={19} tint={t.bad} />
                </TonalTile>
              }
              title={formatText(expense.vendor || expense.description, "Expense")}
              subtitle={`${formatText(expense.category, "Expense")} · ${formatDate(expense.date ?? expense.createdAt)}`}
              trailing={
                <DSText variant="bodyMedium" tint={t.bad} style={styles.moneyValue}>
                  {`− ${formatMoney(expense.amount)}`}
                </DSText>
              }
              chevron
              onPress={() => toggle(expense)}
            />
            {expanded ? (
              <View style={[styles.expenseDetail, { borderColor: t.line }]}>
                <DSText variant="label" tint={t.mute}>
                  {[expense.paymentMethod, expense.status, expense.voucherNo ? `Voucher #${expense.voucherNo}` : ""]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </DSText>
                {found === undefined || found === null ? (
                  <DSText variant="label" tint={t.mute}>Loading receipts…</DSText>
                ) : found.length === 0 ? (
                  <DSText variant="label" tint={t.mute}>No receipts linked yet.</DSText>
                ) : (
                  found.map((voucher) => (
                    <View key={voucher.id} style={styles.paperRow}>
                      <DSText variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>
                        {voucherLine(voucher)}
                      </DSText>
                      <DSText variant="bodyMedium" tint={t.ok}>{formatMoney(voucher.amount)}</DSText>
                    </View>
                  ))
                )}
              </View>
            ) : null}
          </View>
        );
      }}
      ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: t.line }]} />}
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => { refresh(); refreshBook(); }}
          tintColor={t.blue}
        />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <PageTitle>Expenses</PageTitle>
          <View style={styles.moneyRow}>
            <Card style={styles.moneyCard}>
              <TonalTile bg={t.okBg} size={34}>
                <Icon name="trending-up" size={18} tint={t.ok} />
              </TonalTile>
              <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
                {formatMoneyShort(totals.income)}
              </DSText>
              <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>INCOME</DSText>
            </Card>
            <Card style={styles.moneyCard}>
              <TonalTile bg={t.badBg} size={34}>
                <Icon name="trending-down" size={18} tint={t.bad} />
              </TonalTile>
              <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
                {formatMoneyShort(totals.expense)}
              </DSText>
              <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>EXPENSE</DSText>
            </Card>
            <Card style={styles.moneyCard}>
              <TonalTile bg={closingBalance >= 0 ? t.tint : t.badBg} size={34}>
                <Icon
                  name="account-balance"
                  size={18}
                  tint={closingBalance >= 0 ? t.blue : t.bad}
                />
              </TonalTile>
              <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
                {formatMoneyShort(closingBalance)}
              </DSText>
              <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>BALANCE</DSText>
            </Card>
          </View>
          <DSText variant="overline">RECENT EXPENSES · TAP FOR RECEIPTS</DSText>
        </View>
      }
      ListEmptyComponent={
        <EmptyState icon="receipt-long" label="No expenses recorded yet." />
      }
      ListFooterComponent={
        loadingMore ? (
          <ActivityIndicator size="small" color={t.blue} style={{ paddingVertical: space.md }} />
        ) : !hasMore && expenses.length > 0 ? (
          <DSText variant="caption" tint={t.mute} style={{ textAlign: "center", paddingVertical: space.sm }}>
            That’s all {expenses.length} expenses.
          </DSText>
        ) : null
      }
      onEndReached={() => void loadMore()}
      onEndReachedThreshold={0.4}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={7}
      removeClippedSubviews={true}
    />
  );
}

/* ----------------------------------------------------------------- Tasks */

export function TaskAssignScreen() {
  const { t } = useTheme();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [posting, setPosting] = useState(false);
  const [busyCancelId, setBusyCancelId] = useState<string | null>(null);
  const { teachers } = useStaffDirectory();
  const { tasks, loading, error, refresh } = useTasks();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return teachers
      .filter((member) =>
        `${member.fullName ?? ""} ${member.employeeId ?? ""} ${member.subject ?? ""}`
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 8);
  }, [teachers, query]);

  const assigned = useMemo(() => tasks.filter((task) => task.status === "assigned"), [tasks]);

  const submit = async () => {
    if (!teacherId || !title.trim()) {
      toast.show("Pick a teacher and enter a title.");
      return;
    }
    if (dueDate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())) {
      toast.show("Due date must be YYYY-MM-DD (or leave it empty).");
      return;
    }
    setPosting(true);
    try {
      await assignTask({
        teacherId,
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate.trim() || undefined
      });
      toast.show(`Task assigned to ${teacherName || "teacher"} ✓`);
      setTitle("");
      setDescription("");
      setDueDate("");
      refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Unable to assign task.");
    } finally {
      setPosting(false);
    }
  };

  const cancel = async (taskId: string) => {
    setBusyCancelId(taskId);
    try {
      await updateTaskStatus(taskId, "cancelled");
      toast.show("Task cancelled.");
      refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't cancel the task.");
    } finally {
      setBusyCancelId(null);
    }
  };

  return (
    <FlatList
      data={assigned}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ListRow
          leading={
            <TonalTile bg={t.warnBg}>
              <Icon name="assignment" size={19} tint={t.warn} />
            </TonalTile>
          }
          title={formatText(item.title, "Task")}
          subtitle={`${formatText(item.teacherName, "Teacher")}${item.dueDate ? ` · Due ${item.dueDate}` : ""}`}
          trailing={
            <PillButton
              label={busyCancelId === item.id ? "Saving…" : "Cancel"}
              icon="close"
              bg={t.badBg}
              fg={t.bad}
              onPress={() => { if (!busyCancelId) void cancel(item.id); }}
            />
          }
        />
      )}
      ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: t.line }]} />}
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={t.blue} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <PageTitle>Assign task</PageTitle>
          <SectionCard heading="NEW TASK">
            <TextField
              value={query}
              onChangeText={(text) => { setQuery(text); }}
              placeholder="Search teacher by name, ID or subject"
              accessibilityLabel="Search teacher"
            />
            {matches.length > 0 ? (
              <View style={{ gap: 2 }}>
                {matches.map((member) => (
                  <ListRow
                    key={member.id}
                    leading={<Avatar label={initials(member.fullName ?? "?")} size={36} />}
                    title={member.fullName ?? "Unnamed"}
                    subtitle={`${member.subject ?? "—"}${member.employeeId ? ` · ${member.employeeId}` : ""}`}
                    chevron={teacherId !== member.id}
                    trailing={
                      teacherId === member.id ? (
                        <DSText variant="caption" tint={t.ok}>Selected ✓</DSText>
                      ) : undefined
                    }
                    onPress={() => {
                      setTeacherId(member.id);
                      setTeacherName(member.fullName ?? "");
                      setQuery(member.fullName ?? "");
                    }}
                  />
                ))}
              </View>
            ) : null}
            {teacherId ? (
              <DSText variant="label" tint={t.ok}>To: {teacherName || teacherId}</DSText>
            ) : null}
            <TextField
              value={title}
              onChangeText={setTitle}
              placeholder="Title — e.g. Decorate the notice board"
              accessibilityLabel="Task title"
            />
            <TextField
              value={description}
              onChangeText={setDescription}
              placeholder="Details (optional)"
              multiline
              accessibilityLabel="Task details"
            />
            <TextField
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="Due date YYYY-MM-DD (optional)"
              accessibilityLabel="Due date"
            />
            <PillButton
              label={posting ? "Assigning…" : "Assign task"}
              block
              bg={t.blue}
              fg="#FFFFFF"
              icon="send"
              onPress={() => { if (!posting) void submit(); }}
            />
          </SectionCard>
          <DSText variant="overline">OPEN TASKS · {assigned.length}</DSText>
        </View>
      }
      ListEmptyComponent={
        loading ? null : error ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : (
          <EmptyState icon="task-alt" label="No open tasks. Assigned tasks appear here." />
        )
      }
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={7}
      removeClippedSubviews={true}
    />
  );
}

/* ---------------------------------------------------------------- Profile */

export function ManagementProfileScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const session = useMobileSession();
  const { stats } = useDashboardStats();
  const attendance = useTodayAttendance();

  const name = session.profile?.displayName ?? "Administrator";
  /**
   * Only link to routes that exist in THIS workspace — an accountant has no
   * /accountant/staff, a principal has no /principal/fees. Building the menu
   * from the workspace kind keeps every link reachable.
   */
  const workspace = workspaceForRole(session.profile?.role);
  const base = dashboardPathForRole(session.profile?.role);
  const manageLinks: { icon: IconName; title: string; href: string }[] =
    workspace === "accountant"
      ? [
          { icon: "receipt-long", title: "Collections", href: `${base}/collections` },
          { icon: "schedule", title: "Outstanding dues", href: `${base}/dues` }
        ]
      : workspace === "principal"
        ? [
            { icon: "groups", title: "Staff directory", href: `${base}/staff` },
            { icon: "fact-check", title: "Leave approvals", href: `${base}/approvals` }
          ]
        : [
            { icon: "groups", title: "Staff directory", href: `${base}/staff` },
            { icon: "fact-check", title: "Leave approvals", href: `${base}/approvals` },
            { icon: "payments", title: "Fee collection", href: `${base}/fees` },
            { icon: "campaign", title: "Notices", href: `${base}/notices` }
          ];

  const tileForIndex = (index: number) => {
    const tones = [
      { bg: t.tint, tint: t.blue },
      { bg: t.warnBg, tint: t.warn },
      { bg: t.okBg, tint: t.ok },
      { bg: t.tint, tint: t.blue }
    ];
    return tones[index % tones.length];
  };

  const logout = async () => {
    try {
      await session.logout();
      router.replace("/login" as never);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Logout failed. Please try again.");
    }
  };

  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmLogout = () => setConfirmOpen(true);

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.identityRow}>
        <Avatar label={initials(name)} size={64} bg={t.blue} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <DSText variant="title" style={{ fontSize: 19 }} numberOfLines={1}>{name}</DSText>
          <DSText variant="label">{workspaceLabel(session.profile?.role)}</DSText>
          <DSText variant="label">
            {displayLoginContact(session.profile)}
          </DSText>
        </View>
      </View>

      <View style={styles.statRow}>
        <Card style={styles.moneyCard}>
          <TonalTile bg={t.tint} size={34}>
            <Icon name="school" size={18} tint={t.blue} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {stats?.totalStudents ?? 0}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>STUDENTS</DSText>
        </Card>
        <Card style={styles.moneyCard}>
          <TonalTile bg={t.tint} size={34}>
            <Icon name="groups" size={18} tint={t.blue} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {attendance.total}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>STAFF</DSText>
        </Card>
        <Card style={styles.moneyCard}>
          <TonalTile bg={t.okBg} size={34}>
            <Icon name="payments" size={18} tint={t.ok} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {formatMoney(stats?.monthlyCollection)}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>THIS MONTH</DSText>
        </Card>
      </View>

      <DSText variant="overline">MANAGE</DSText>
      <View style={styles.actionGrid}>
        {manageLinks.map((link, index) => {
          const tile = tileForIndex(index);
          return (
            <PressableScale
              key={link.href}
              accessibilityLabel={link.title}
              onPress={() => router.push(link.href as never)}
              style={styles.actionPress}
            >
              <Card style={styles.actionTile}>
                <TonalTile bg={tile.bg} size={36}>
                  <Icon name={link.icon} size={19} tint={tile.tint} />
                </TonalTile>
                <DSText variant="bodyMedium" numberOfLines={2} style={styles.actionLabel}>{link.title}</DSText>
                <DSText variant="label" tint={t.blue}>
                  Open →
                </DSText>
              </Card>
            </PressableScale>
          );
        })}
      </View>

      <DSText variant="overline">MORE</DSText>
      <View style={styles.actionGrid}>
        <PressableScale
          accessibilityLabel="Reports and exports"
          onPress={() => openWebsite("/admin/reports", "Reports & exports")}
          style={styles.actionPress}
        >
          <Card style={styles.actionTile}>
            <TonalTile bg={t.tint} size={36}>
              <Icon name="insights" size={19} tint={t.blue} />
            </TonalTile>
            <DSText variant="bodyMedium" style={styles.actionLabel}>Reports & exports</DSText>
            <DSText variant="label">Opens the website in your browser</DSText>
            <DSText variant="label" tint={t.blue}>
              Open →
            </DSText>
          </Card>
        </PressableScale>
        <PressableScale
          accessibilityLabel="Help and support"
          onPress={() => router.push("/support" as never)}
          style={styles.actionPress}
        >
          <Card style={styles.actionTile}>
            <TonalTile bg={t.warnBg} size={36}>
              <Icon name="help-outline" size={19} tint={t.warn} />
            </TonalTile>
            <DSText variant="bodyMedium" style={styles.actionLabel}>Help & support</DSText>
            <DSText variant="label">Contact your administrator</DSText>
            <DSText variant="label" tint={t.blue}>
              Contact →
            </DSText>
          </Card>
        </PressableScale>
      </View>

      <PillButton label="Logout from this device" block bg={t.bad} fg="#FFFFFF" icon="logout" onPress={confirmLogout} />

      <BottomSheet
        visible={confirmOpen}
        title="Log out?"
        onClose={() => setConfirmOpen(false)}
      >
        <DSText variant="label">You are getting logged out from this device.</DSText>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
          <View style={{ flex: 1 }}>
            <PillButton label="Stay" block onPress={() => setConfirmOpen(false)} />
          </View>
          <View style={{ flex: 1 }}>
            <PillButton
              label="Log out"
              block
              bg={t.bad}
              fg="#FFFFFF"
              onPress={() => { setConfirmOpen(false); void logout(); }}
            />
          </View>
        </View>
      </BottomSheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, paddingTop: space.md, gap: 14 },
  header: { gap: 14 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 56 },
  sectionTitle: { marginTop: space.sm },
  examPaper: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md
  },
  divider: { height: StyleSheet.hairlineWidth },
  statRow: { flexDirection: "row", gap: space.sm },
  moneyGrid: { gap: 10 },
  moneyRow: { flexDirection: "row", gap: 10 },
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
  identityRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 10 },
  decisionRow: { flexDirection: "row", gap: space.md, marginTop: space.md },
  expenseDetail: {
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.xs
  },
  paperRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  viewAll: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: space.sm
  },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionPress: { flex: 1, minWidth: "46%" },
  actionTile: { gap: 8 },
  actionLabel: { fontWeight: "700" }
});
