/**
 * Accountant Collections — receipt list with payment-method filters.
 * Read-only: recording payments stays in the web dashboard (see index.tsx).
 */
import React, { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  DSText, EmptyState, ErrorState, FilterChips, Icon, ListRow, LoadingState,
  PageTitle, SectionCard, StatTile, TonalTile
} from "@/design-system/components";
import { color, space } from "@/design-system/tokens";
import { AccountantShell } from "@/features/admin/shell";
import { formatDate, formatMoney, formatMoneyShort, useRecentPayments } from "@/features/admin/hooks";

const FILTERS = ["All", "Cash", "Online", "Cheque"];

export default function AccountantCollectionsRoute() {
  return (
    <AccountantShell>
      <AccountantCollections />
    </AccountantShell>
  );
}

function AccountantCollections() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState("All");
  const { payments, loading, error, refresh } = useRecentPayments();

  const visible = useMemo(() => {
    if (filter === "All") return payments;
    return payments.filter((p) => (p.paymentMethod ?? "").toLowerCase() === filter.toLowerCase());
  }, [payments, filter]);

  const total = useMemo(
    () => visible.reduce((sum, p) => sum + Number(p.amountPaid ?? 0), 0),
    [visible]
  );

  if (loading && payments.length === 0) return <LoadingState label="Loading receipts…" />;
  if (error && payments.length === 0) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xs }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={color.primary} />}
    >
      <PageTitle>Collections</PageTitle>

      <View style={styles.statRow}>
        <StatTile value={visible.length} label="Receipts" tint={color.primary} />
        <StatTile value={formatMoneyShort(total)} label={`${filter} total`} tint={color.success} />
      </View>

      <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

      <SectionCard heading={`${visible.length} RECEIPT${visible.length === 1 ? "" : "S"}`}>
        {visible.length === 0 ? (
          <EmptyState icon="receipt-long" label={`No ${filter.toLowerCase()} payments in this period.`} />
        ) : (
          visible.map((payment) => (
            <ListRow
              key={payment.id}
              leading={
                <TonalTile bg={color.successContainer}>
                  <Icon name="receipt" size={19} tint={color.success} />
                </TonalTile>
              }
              title={payment.studentName ?? "Payment"}
              subtitle={`${payment.paymentMethod || "—"}${payment.receiptNumber ? ` · Receipt ${payment.receiptNumber}` : ""}`}
              trailing={
                <View style={{ alignItems: "flex-end" }}>
                  <DSText variant="bodyMedium" tint={color.success}>{formatMoney(payment.amountPaid)}</DSText>
                  <DSText variant="caption">{formatDate(payment.createdAt)}</DSText>
                </View>
              }
            />
          ))
        )}
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 },
  statRow: { flexDirection: "row", gap: 10 }
});
