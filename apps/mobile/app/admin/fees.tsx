/**
 * Admin Finance — collection summary, recent receipts and finance position.
 */
import React, { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import {
  Card, DSText, EmptyState, ErrorState, FilterChips, Icon, ListRow, SkeletonPage,
  PageTitle, ProgressRow, SectionCard, TonalTile
} from "@/design-system/components";
import { radius, space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import { AdminShell } from "@/features/admin/shell";
import {
  formatMoney, formatMoneyShort, useDashboardStats, useExpenses, useFinanceSummary,
  useRecentPayments, buildTransactions, type TxnRow
} from "@/features/admin/hooks";

const FILTERS = ["All", "Cash", "Online"];

export default function AdminFeesRoute() {
  return (
    <AdminShell>
      <AdminFees />
    </AdminShell>
  );
}

function AdminFees() {
  const { t } = useTheme();
  const [filter, setFilter] = useState("All");
  const { stats, loading, error, refresh } = useDashboardStats();
  const { payments, refresh: refreshPayments } = useRecentPayments();
  const { expenses, refresh: refreshExpenses } = useExpenses();
  const { summary } = useFinanceSummary();

  const visible = useMemo(
    () => buildTransactions(payments, expenses, filter),
    [payments, expenses, filter]
  );

  if (loading && !stats) return <SkeletonPage />;
  if (error && !stats) return <ErrorState message={error} onRetry={refresh} />;

  const collectionRate = stats && stats.totalFeeAmount > 0
    ? (stats.totalFeeCollected / stats.totalFeeAmount) * 100
    : 0;

  const renderTxn = ({ item: row }: { item: TxnRow }) => {
    const income = row.kind === "income";
    return (
      <ListRow
        leading={
          <TonalTile bg={income ? t.okBg : t.badBg}>
            <Icon name="receipt" size={19} tint={income ? t.ok : t.bad} />
          </TonalTile>
        }
        title={row.title}
        subtitle={row.subtitle}
        trailing={
          <View style={{ alignItems: "flex-end" }}>
            <DSText
              variant="bodyMedium"
              tint={income ? t.ok : t.bad}
              style={styles.receiptMoney}
            >
              {income ? formatMoney(row.amount) : `− ${formatMoney(row.amount)}`}
            </DSText>
            <DSText variant="caption">{row.dateLabel}</DSText>
          </View>
        }
      />
    );
  };

  return (
    <FlatList
      data={visible}
      keyExtractor={(row) => row.id}
      renderItem={renderTxn}
      ItemSeparatorComponent={() => <View style={[styles.divider, { backgroundColor: t.line }]} />}
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => { refresh(); refreshPayments(); refreshExpenses(); }}
          tintColor={t.blue}
        />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <PageTitle>Finance</PageTitle>

      <View style={styles.statRow}>
        <Card style={styles.moneyCard}>
          <TonalTile bg={t.okBg} size={36}>
            <Icon name="trending-up" size={19} tint={t.ok} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {formatMoneyShort(stats?.totalFeeCollected)}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>COLLECTED</DSText>
        </Card>
        <Card style={styles.moneyCard}>
          <TonalTile bg={t.badBg} size={36}>
            <Icon name="error-outline" size={19} tint={t.bad} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {formatMoneyShort(stats?.totalFeeOutstanding)}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>DUE</DSText>
        </Card>
        <Card style={styles.moneyCard}>
          <TonalTile bg={t.tint} size={36}>
            <Icon name="calendar-month" size={19} tint={t.blue} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {formatMoneyShort(stats?.monthlyCollection)}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>THIS MONTH</DSText>
        </Card>
      </View>

      <Card style={{ gap: space.md }}>
        <DSText variant="overline">COLLECTION PROGRESS</DSText>
        <ProgressRow
          label="Against total demand"
          percent={collectionRate}
          valueLabel={`${Math.round(collectionRate)}%`}
          tint={collectionRate >= 75 ? t.ok : t.warn}
        />
        <DSText variant="label">
          {formatMoney(stats?.totalFeeCollected)} of {formatMoney(stats?.totalFeeAmount)} ·{" "}
          {stats?.studentsWithOutstandingFees ?? 0} students still owe
        </DSText>
      </Card>

      {summary ? (
        <SectionCard heading="FINANCE POSITION">
          <ListRow
            leading={<TonalTile bg={t.okBg}><Icon name="arrow-downward" size={19} tint={t.ok} /></TonalTile>}
            title={formatMoney(summary.income.total)}
            subtitle="Total income"
          />
          <View style={[styles.divider, { backgroundColor: t.line }]} />
          <ListRow
            leading={<TonalTile bg={t.badBg}><Icon name="arrow-upward" size={19} tint={t.bad} /></TonalTile>}
            title={formatMoney(summary.expense.total)}
            subtitle={`Salary ${formatMoneyShort(summary.expense.salary)} · General ${formatMoneyShort(summary.expense.general)}`}
          />
          <View style={[styles.divider, { backgroundColor: t.line }]} />
          <ListRow
            leading={
              <TonalTile bg={summary.net >= 0 ? t.tint : t.badBg}>
                <Icon name="account-balance" size={19} tint={summary.net >= 0 ? t.blue : t.bad} />
              </TonalTile>
            }
            title={formatMoney(summary.net)}
            subtitle="Net position"
          />
        </SectionCard>
      ) : null}

      <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
          <DSText variant="overline">RECENT RECEIPTS</DSText>
        </View>
      }
      ListEmptyComponent={
        <EmptyState icon="receipt-long" label={`No ${filter.toLowerCase()} transactions in this period.`} />
      }
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={7}
      removeClippedSubviews={true}
    />
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, paddingTop: space.md, gap: 14 },
  header: { gap: 14 },
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
  receiptMoney: { fontWeight: "800" },
  divider: { height: StyleSheet.hairlineWidth }
});
