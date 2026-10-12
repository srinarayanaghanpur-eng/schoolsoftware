/**
 * Parent Finance tab (Phase 4) — fee summary from /api/portal/summary plus full
 * payment history from /api/portal/payments. Receipts open the share sheet
 * with data from /api/portal/payments/[paymentId]/receipt.
 */
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, Share, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Avatar, DSText, EmptyState, ErrorState, FilterChips, ListRow,
  PageTitle, PillButton, SkeletonRows, useToast
} from "@/design-system/components";
import { radius, space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import { ParentShell } from "@/features/parent/shell";
import { ChildSwitcher } from "@/features/parent/ChildSwitcher";
import { useSelectChild, useSelectedChildId, useSelectedChildRaw } from "@/features/parent/SelectedChild";
import { fetchReceipt } from "@/features/parent/api";
import { formatMoney, initials, useParentPayments, useParentSummary } from "@/features/parent/hooks";

export default function ParentFeesRoute() {
  return (
    <ParentShell>
      <ParentFeesScreen />
    </ParentShell>
  );
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank_transfer: "Bank",
  cheque: "Cheque"
};

function ParentFeesScreen() {
  const { t } = useTheme();
  const toast = useToast();
  const rawChoice = useSelectedChildRaw();
  const { summary, linkedStudents, loading: summaryLoading, error: summaryError, refresh: refreshSummary } =
    useParentSummary(rawChoice);
  const select = useSelectChild();
  const activeId = useSelectedChildId(linkedStudents);
  const { payments, loading: paymentsLoading, error: paymentsError, refresh: refreshPayments } =
    useParentPayments(activeId);
  const [methodFilter, setMethodFilter] = useState("All");

  const methods = useMemo(() => {
    const seen: string[] = [];
    for (const payment of payments) {
      const method = payment.paymentMethod || "other";
      if (!seen.includes(method)) seen.push(method);
    }
    return ["All", ...seen];
  }, [payments]);

  const visible = useMemo(() => {
    if (methodFilter === "All") return payments;
    return payments.filter((p) => (p.paymentMethod || "other") === methodFilter);
  }, [payments, methodFilter]);

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

  if (loading && !summary) return <SkeletonRows count={3} />;
  if ((summaryError && !summary) || (!loading && !summary)) {
    return <ErrorState message={summaryError || "No student is linked to this account yet."} onRetry={refresh} />;
  }

  const studentName = summary?.student.name ?? "Fees";
  const studentMeta = summary
    ? `Class ${summary.student.className}${summary.student.section} · Adm ${summary.student.admissionNo}`
    : "";

  // Virtualized: payment history grows every term and must not all mount.
  return (
    <FlatList
      data={visible}
      keyExtractor={(payment) => payment.id}
      renderItem={({ item: payment }) => (
        <ListRow
          leading={
            <Avatar label={summary ? initials(summary.student.name) : "—"} size={40} bg={t.tint} fg={t.blue} />
          }
          title={studentName}
          subtitle={`${summary ? `Class ${summary.student.className} · ` : ""}${payment.paymentMethod || "—"}${payment.receiptNumber ? ` · Receipt ${payment.receiptNumber}` : ""}`}
          trailing={
            <View style={{ alignItems: "flex-end" }}>
              <DSText variant="bodyMedium" style={styles.receiptMoney}>{formatMoney(payment.amountPaid)}</DSText>
              <DSText variant="caption">{(payment.createdAt || "").slice(0, 10)}</DSText>
            </View>
          }
          chevron
          onPress={() => void shareReceipt(payment.id)}
        />
      )}
      ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: t.line }]} />}
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={t.blue} />}
      initialNumToRender={15}
      maxToRenderPerBatch={15}
      windowSize={7}
      removeClippedSubviews={true}
      ListHeaderComponent={
        <View style={styles.header}>
          <PageTitle>Finance</PageTitle>
          <ChildSwitcher children={linkedStudents} selectedId={activeId} onSelect={select} />

          <View style={[styles.identityRow, { backgroundColor: t.card, borderColor: t.line }]}>
            <Avatar
              label={summary ? initials(summary.student.name) : "—"}
              size={46}
              bg={t.tint}
              fg={t.blue}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <DSText variant="title" style={styles.identityName} numberOfLines={1}>
                {studentName}
              </DSText>
              <DSText variant="label" numberOfLines={1}>
                {studentMeta}
              </DSText>
            </View>
          </View>

          {summary ? (
            <LinearGradient
              colors={[t.heroFrom, t.heroMid, t.heroTo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hero}
            >
              <View style={styles.heroCircle} pointerEvents="none" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <DSText variant="caption" tint="rgba(255,255,255,0.8)">OUTSTANDING</DSText>
                <DSText variant="display" tint="#FFFFFF" style={styles.heroMoney} numberOfLines={1}>
                  {summary.fees.due > 0 ? formatMoney(summary.fees.due) : "All clear"}
                </DSText>
                <DSText variant="label" tint="rgba(255,255,255,0.8)" numberOfLines={2}>
                  {`${formatMoney(summary.fees.paid)} paid of ${formatMoney(summary.fees.total)}${summary.fees.status ? ` · ${summary.fees.status}` : ""}`}
                </DSText>
              </View>
              {summary.fees.due > 0 ? (
                <PillButton
                  label="Pay now"
                  bg="#FFFFFF"
                  fg={t.blue}
                  onPress={() => toast.show("Please pay at the school office or web portal.")}
                />
              ) : null}
            </LinearGradient>
          ) : null}

          <DSText variant="overline">PAYMENT HISTORY</DSText>
          {methods.length > 2 ? (
            <FilterChips
              options={methods.map((method) => (method === "All" ? "All" : METHOD_LABELS[method] ?? method))}
              value={methodFilter === "All" ? "All" : METHOD_LABELS[methodFilter] ?? methodFilter}
              onChange={(label) => {
                const found = methods.find((method) => (method === "All" ? "All" : METHOD_LABELS[method] ?? method) === label);
                setMethodFilter(found ?? "All");
              }}
            />
          ) : null}
        </View>
      }
      ListEmptyComponent={
        loading ? null : paymentsError && visible.length === 0 ? (
          <ErrorState message={paymentsError} onRetry={refresh} />
        ) : (
          <EmptyState
            icon="receipt"
            label={methodFilter === "All" ? "No payments recorded yet." : `No ${METHOD_LABELS[methodFilter] ?? methodFilter} payments yet.`}
          />
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
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, paddingTop: space.md, gap: 14 },
  header: { gap: 14 },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space.lg
  },
  identityName: { fontSize: 17, fontWeight: "700" },
  hero: {
    borderRadius: radius.xl,
    padding: space.lg,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    overflow: "hidden"
  },
  heroCircle: {
    position: "absolute",
    top: -70,
    right: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.1)"
  },
  heroMoney: { fontSize: 26, fontWeight: "800" },
  receiptMoney: { fontWeight: "800" },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 52 },
  hint: { alignItems: "center" }
});
