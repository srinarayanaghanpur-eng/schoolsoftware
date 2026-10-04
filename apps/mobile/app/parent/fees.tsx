/**
 * Parent Fees tab (Phase 4) — fee summary from /api/portal/summary plus full
 * payment history from /api/portal/payments. Receipts open the share sheet
 * with data from /api/portal/payments/[paymentId]/receipt.
 */
import React, { useCallback } from "react";
import { FlatList, RefreshControl, Share, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  DSText, EmptyState, ErrorState, Icon, ListRow, LoadingState,
  SectionCard, TonalTile, useToast
} from "@/design-system/components";
import { color, space } from "@/design-system/tokens";
import { ParentShell } from "@/features/parent/shell";
import { ChildSwitcher } from "@/features/parent/ChildSwitcher";
import { useSelectChild, useSelectedChildId, useSelectedChildRaw } from "@/features/parent/SelectedChild";
import { fetchReceipt } from "@/features/parent/api";
import { formatMoney, useParentPayments, useParentSummary } from "@/features/parent/hooks";

export default function ParentFeesRoute() {
  return (
    <ParentShell>
      <ParentFeesScreen />
    </ParentShell>
  );
}

function ParentFeesScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const rawChoice = useSelectedChildRaw();
  const { summary, linkedStudents, loading: summaryLoading, error: summaryError, refresh: refreshSummary } =
    useParentSummary(rawChoice);
  const select = useSelectChild();
  const activeId = useSelectedChildId(linkedStudents);
  const { payments, loading: paymentsLoading, error: paymentsError, refresh: refreshPayments } =
    useParentPayments(activeId);

  const loading = summaryLoading || paymentsLoading;
  const refresh = useCallback(() => {
    refreshSummary();
    refreshPayments();
  }, [refreshSummary, refreshPayments]);

  const shareReceipt = useCallback(async (paymentId: string) => {
    try {
      const { receipt } = await fetchReceipt(paymentId);
      const lines = [
        receipt.schoolName,
        receipt.schoolAddress,
        `Receipt: ${receipt.receiptNo}`,
        `Date: ${receipt.date}`,
        receipt.student ? `Student: ${receipt.student.name} (${receipt.student.admissionNo})` : "",
        receipt.student ? `Class: ${receipt.student.className}${receipt.student.section}` : "",
        `Amount: ₹${receipt.amount}`,
        `Method: ${receipt.paymentMethod || "—"}`,
        receipt.transactionId ? `Txn: ${receipt.transactionId}` : "",
        `Status: ${receipt.status}`
      ].filter(Boolean).join("\n");
      await Share.share({ message: lines, title: `Receipt ${receipt.receiptNo}` });
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Unable to load receipt.");
    }
  }, [toast]);

  if (loading && !summary) return <LoadingState label="Loading fee details…" />;
  if ((summaryError && !summary) || (!loading && !summary)) {
    return <ErrorState message={summaryError || "No student is linked to this account yet."} onRetry={refresh} />;
  }

  // Virtualized: payment history grows every term and must not all mount.
  return (
    <FlatList
      data={payments}
      keyExtractor={(payment) => payment.id}
      renderItem={({ item: payment }) => (
        <ListRow
          leading={
            <TonalTile bg={color.successContainer} size={36}>
              <Icon name="receipt" size={18} tint={color.success} />
            </TonalTile>
          }
          title={`${formatMoney(payment.amountPaid)} · ${payment.paymentMethod || "—"}`}
          subtitle={`${(payment.createdAt || "").slice(0, 10)}${payment.receiptNumber ? ` · Receipt ${payment.receiptNumber}` : ""}`}
          chevron
          onPress={() => void shareReceipt(payment.id)}
        />
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.sm }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={color.primary} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <ChildSwitcher children={linkedStudents} selectedId={activeId} onSelect={select} />

          {summary ? (
            <SectionCard heading="FEE SUMMARY">
              <ListRow
                leading={
                  <TonalTile bg={color.primaryContainer} size={36}>
                    <Icon name="payments" size={18} tint={color.onPrimaryContainer} />
                  </TonalTile>
                }
                title={`${formatMoney(summary.fees.paid)} paid of ${formatMoney(summary.fees.total)}`}
                subtitle={summary.fees.status ? `Status: ${summary.fees.status}` : `${summary.student.name} · Class ${summary.student.className}${summary.student.section}`}
              />
              <ListRow
                leading={
                  <TonalTile bg={summary.fees.due > 0 ? color.warningContainer : color.successContainer} size={36}>
                    <Icon
                      name={summary.fees.due > 0 ? "schedule" : "check"}
                      size={18}
                      tint={summary.fees.due > 0 ? color.warning : color.success}
                    />
                  </TonalTile>
                }
                title={summary.fees.due > 0 ? `${formatMoney(summary.fees.due)} outstanding` : "No dues — all clear"}
                subtitle={summary.fees.due > 0 ? "Pay at the school office or web portal" : undefined}
              />
            </SectionCard>
          ) : null}

          <DSText variant="overline">PAYMENT HISTORY</DSText>
        </View>
      }
      ListEmptyComponent={
        loading ? null : paymentsError ? (
          <ErrorState message={paymentsError} onRetry={refresh} />
        ) : (
          <EmptyState icon="receipt" label="No payments recorded yet." />
        )
      }
      ListFooterComponent={
        <View style={styles.hint}>
          <DSText variant="label">Tap a payment to share its receipt.</DSText>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 },
  header: { gap: 14 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: color.outline, marginLeft: 52 },
  hint: { alignItems: "center" }
});
