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
  const feeHeads = (student.feeHeads ?? []).filter(
    (head) => head && (head.name || head.committed || head.original || head.amount)
  );

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

      {feeHeads.length > 0 ? (
        <SectionCard heading="FEE BREAKDOWN">
          {feeHeads.map((head, index) => (
            <View key={`${head.name ?? "fee"}-${index}`}>
              {index > 0 ? <View style={[styles.divider, { backgroundColor: t.line }]} /> : null}
              <ListRow
                title={formatMoney(head.committed ?? head.original ?? head.amount ?? 0)}
                subtitle={formatText(head.name, "Fee")}
              />
            </View>
          ))}
        </SectionCard>
      ) : null}

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
