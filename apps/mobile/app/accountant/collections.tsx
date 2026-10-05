/**
 * Accountant Collections — receipt list with payment-method filters.
 * Read-only: recording payments stays in the web dashboard (see index.tsx).
 */
import React, { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import {
  Card, DSText, EmptyState, ErrorState, FilterChips, Icon, ListRow, LoadingState,
  PageTitle, PillButton, SectionCard, TonalTile, useToast
} from "@/design-system/components";
import { radius, space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
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
  const { t } = useTheme();
  const toast = useToast();
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
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={t.blue} />}
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

      <PillButton
        label="Record a payment"
        block
        bg={t.blue}
        fg="#FFFFFF"
        onPress={() => toast.show("Recording payments and issuing receipts is done in the web dashboard.")}
      />

      <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

      <SectionCard heading={`${visible.length} RECEIPT${visible.length === 1 ? "" : "S"}`}>
        {visible.length === 0 ? (
          <EmptyState icon="receipt-long" label={`No ${filter.toLowerCase()} payments in this period.`} />
        ) : (
          visible.map((payment, index) => (
            <View key={payment.id}>
              {index > 0 ? <View style={[styles.divider, { backgroundColor: t.line }]} /> : null}
              <ListRow
                leading={
                  <TonalTile bg={t.okBg}>
                    <Icon name="receipt" size={19} tint={t.ok} />
                  </TonalTile>
                }
                title={payment.studentName ?? "Payment"}
                subtitle={`${payment.paymentMethod || "—"}${payment.receiptNumber ? ` · Receipt ${payment.receiptNumber}` : ""}`}
                trailing={
                  <View style={{ alignItems: "flex-end" }}>
                    <DSText variant="bodyMedium" tint={t.ok} style={styles.receiptMoney}>{formatMoney(payment.amountPaid)}</DSText>
                    <DSText variant="caption">{formatDate(payment.createdAt)}</DSText>
                  </View>
                }
              />
            </View>
          ))
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
