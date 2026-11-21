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

export function ReceiptDetailScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const base = useBasePath();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const receiptId = Array.isArray(params.id) ? params.id[0] : params.id ?? "";
  const [receipt, setReceipt] = useState<ReceiptRecord | null>(null);
  const [history, setHistory] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
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

  const shareReceiptLink = useCallback(async () => {
    if (!receipt) return;
    setSharing(true);
    try {
      const { url } = await fetchReceiptShareLink(receipt.id ?? receiptId);
      if (!url) throw new Error("Receipt link is unavailable.");
      await Share.share({
        title: `Receipt ${receipt.receiptNo ?? ""}`,
        message: [
          "Dear Parent,",
          `Fee payment receipt ${receipt.receiptNo ?? ""} for ${receipt.studentName ?? "student"}.`,
          `Amount paid: ${formatMoney(receipt.totalPaid)}`,
          `View receipt: ${url}`
        ].join("\n"),
        url
      });
    } catch (err) {
      Alert.alert("Unable to share receipt", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSharing(false);
    }
  }, [receipt, receiptId]);

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

      <PillButton
        label={sharing ? "Preparing link…" : "Share receipt link"}
        icon="share"
        block
        onPress={sharing ? undefined : () => void shareReceiptLink()}
      />

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
