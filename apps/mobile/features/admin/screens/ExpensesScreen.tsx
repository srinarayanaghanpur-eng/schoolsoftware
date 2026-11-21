/**
 * Shared management screens.
 *
 * Admin and Principal see the same staff / approvals / profile surfaces; the
 * only difference is the surrounding shell and its tab set. Keeping the bodies
 * here means one implementation instead of two drifting copies.
 */
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, SectionList, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
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
import {
  assignTask, createExam, decideChangeRequest, deleteExam, fetchAcademicYears,
  fetchVouchersByCategory, fetchVouchersByIds, reviewLeaveRequest, updateExam,
  updateTaskStatus, type ExamInput
} from "../api";
import type { AdminTeacher, DebitVoucher, Exam, Expense, StaffDriver, StaffOffice } from "../api";
import {
  formatDate, formatMoney, formatMoneyShort, formatText, useCashBook,
  useChangeRequests, useDashboardStats, useExams, useExpenses, useLeaveRequests,
  useStaffDirectory, useTasks, useTodayAttendance
} from "../hooks";
import { styles } from "./styles";
import { ADMIN_OFFICE_ROLES, STAFF_FILTERS, SUPPORT_ROLES, matchesStaffFilter, matchesStaffQuery, normalizeStaffRole, staffCategoryForOffice, staffField } from "./shared";
import type { StaffSection } from "./shared";

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
        const linked = expense.voucherId ? await fetchVouchersByIds([expense.voucherId]) : [];
        const merged = linked.slice(0, 4);
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
