/**
 * Accountant Collections — receipt list with payment-method filters.
 * Read-only: recording payments stays in the web dashboard (see index.tsx).
 */
import React, { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import {
  Card, DSText, EmptyState, ErrorState, FilterChips, Icon, ListRow, SkeletonPage,
  PageTitle, SectionCard, TonalTile
} from "@/design-system/components";
import { radius, space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import { AccountantShell } from "@/features/admin/shell";
import { formatMoney, formatMoneyShort, useExpenses, useRecentPayments, buildTransactions } from "@/features/admin/hooks";

const FILTERS = ["All", "Cash", "Online"];

export default function AccountantCollectionsRoute() {
  return (
    <AccountantShell>
      <AccountantCollections />
    </AccountantShell>
  );
}

function AccountantCollections() {
  const { t } = useTheme();
  const [filter, setFilter] = useState("All");
  const { payments, loading, error, refresh } = useRecentPayments();
  const { expenses, refresh: refreshExpenses } = useExpenses();

  const visible = useMemo(
    () => buildTransactions(payments, expenses, filter),
    [payments, expenses, filter]
  );

  const total = useMemo(
    () => visible.reduce((sum, row) => sum + (row.kind === "income" ? row.amount : 0), 0),
    [visible]
  );

  if (loading && payments.length === 0) return <SkeletonPage />;
  if (error && payments.length === 0) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => { refresh(); refreshExpenses(); }}
          tintColor={t.blue}
        />
      }
    >
      <PageTitle>Collections</PageTitle>

      <View style={styles.statRow}>
        <Card style={styles.moneyCard}>
          <TonalTile bg={t.tint} size={36}>
            <Icon name="receipt-long" size={19} tint={t.blue} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {visible.length}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>RECEIPTS</DSText>
        </Card>
        <Card style={styles.moneyCard}>
          <TonalTile bg={t.okBg} size={36}>
            <Icon name="payments" size={19} tint={t.ok} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {formatMoneyShort(total)}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>{`${filter.toUpperCase()} TOTAL`}</DSText>
        </Card>
      </View>

      <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

      <SectionCard heading={`${visible.length} TRANSACTION${visible.length === 1 ? "" : "S"}`}>
        {visible.length === 0 ? (
          <EmptyState icon="receipt-long" label={`No ${filter.toLowerCase()} transactions in this period.`} />
        ) : (
          visible.map((row, index) => {
            const income = row.kind === "income";
            return (
              <View key={row.id}>
                {index > 0 ? <View style={[styles.divider, { backgroundColor: t.line }]} /> : null}
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
              </View>
            );
          })
        )}
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, paddingTop: space.md, gap: 14 },
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
