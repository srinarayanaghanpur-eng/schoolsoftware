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

export function StaffDetailScreen() {
  const { t } = useTheme();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const teacherId = Array.isArray(params.id) ? params.id[0] : params.id ?? "";
  const [teacher, setTeacher] = useState<AdminTeacherDetail | null>(null);
  const [attendance, setAttendance] = useState<TeacherAttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!teacherId) return;
    setLoading(true);
    setError(null);
    try {
      const [record, summary] = await Promise.all([
        fetchTeacher(teacherId),
        fetchTeacherAttendanceSummary(teacherId).catch(() => null)
      ]);
      setTeacher(record);
      setAttendance(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load staff details.");
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !teacher) return <SkeletonPage />;
  if (error && !teacher) return <ErrorState message={error} onRetry={load} />;
  if (!teacher) return <EmptyState icon="groups" label="Staff member not found." />;

  const status = teacher.status ?? "active";
  const rate = attendance && attendance.workingDays > 0
    ? ((attendance.present + attendance.late) / attendance.workingDays) * 100
    : 0;

  return (
    <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <ScreenBack />
      <View style={styles.identityRow}>
        <Avatar label={initials(teacher.fullName ?? "?")} size={58} bg={t.blue} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <DSText variant="title" numberOfLines={1}>{formatText(teacher.fullName, "Staff member")}</DSText>
          <DSText variant="label">
            {formatText(teacher.subject, "Staff")} · {formatText(teacher.employeeId)}
          </DSText>
          <Badge
            label={status === "active" ? "Active" : "Inactive"}
            bg={status === "active" ? t.okBg : t.line}
            fg={status === "active" ? t.ok : t.mute}
          />
        </View>
      </View>

      <View style={styles.statRow}>
        <Card style={styles.moneyCard}>
          <TonalTile bg={t.tint} size={34}>
            <Icon name="payments" size={18} tint={t.blue} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>{formatMoneyShort(teacher.baseSalary)}</DSText>
          <DSText variant="overline" style={styles.moneyLabel}>BASE SALARY</DSText>
        </Card>
        <Card style={styles.moneyCard}>
          <TonalTile bg={t.okBg} size={34}>
            <Icon name="how-to-reg" size={18} tint={t.ok} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>{attendance?.present ?? 0}</DSText>
          <DSText variant="overline" style={styles.moneyLabel}>PRESENT</DSText>
        </Card>
        <Card style={styles.moneyCard}>
          <TonalTile bg={t.badBg} size={34}>
            <Icon name="person-off" size={18} tint={t.bad} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>{attendance?.absent ?? 0}</DSText>
          <DSText variant="overline" style={styles.moneyLabel}>ABSENT</DSText>
        </Card>
      </View>

      <SectionCard heading="SALARY & EMPLOYMENT">
        <ListRow
          leading={<TonalTile bg={t.okBg}><Icon name="account-balance" size={19} tint={t.ok} /></TonalTile>}
          title={formatMoney(teacher.baseSalary)}
          subtitle="Monthly base salary"
        />
        <View style={[styles.divider, { backgroundColor: t.line }]} />
        <ListRow
          leading={<TonalTile bg={t.tint}><Icon name="event" size={19} tint={t.blue} /></TonalTile>}
          title={formatDate(teacher.joiningDate)}
          subtitle="Joining date"
        />
        <View style={[styles.divider, { backgroundColor: t.line }]} />
        <ListRow
          leading={<TonalTile bg={t.tint}><Icon name="work" size={19} tint={t.blue} /></TonalTile>}
          title={formatText(teacher.employmentType, "Full time")}
          subtitle="Employment type"
        />
        <View style={[styles.divider, { backgroundColor: t.line }]} />
        <ListRow
          leading={<TonalTile bg={t.tint}><Icon name="call" size={19} tint={t.blue} /></TonalTile>}
          title={formatText(teacher.phone, "No phone")}
          subtitle="Contact number"
        />
      </SectionCard>

      <SectionCard heading={`ATTENDANCE · ${attendance?.month ?? "THIS MONTH"}`}>
        {attendance ? (
          <>
            <ListRow
              title={`${attendance.present} present · ${attendance.late} late`}
              subtitle={`${attendance.absent} absent of ${attendance.workingDays} working days`}
            />
            <View style={[styles.divider, { backgroundColor: t.line }]} />
            <View style={{ gap: space.xs, paddingVertical: space.xs }}>
              <DSText variant="label">Attendance rate · {Math.round(rate)}%</DSText>
              <View style={[styles.progressTrack, { backgroundColor: t.line }]}>
                <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, rate))}%`, backgroundColor: rate >= 90 ? t.ok : t.warn }]} />
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: t.line }]} />
            {attendance.records.length === 0 ? (
              <DSText variant="label">No attendance records this month.</DSText>
            ) : (
              attendance.records.slice(0, 12).map((record, index) => (
                <View key={record.date}>
                  {index > 0 ? <View style={[styles.divider, { backgroundColor: t.line }]} /> : null}
                  <ListRow
                    leading={
                      <TonalTile bg={record.status === "late" ? t.warnBg : record.status === "absent" ? t.badBg : t.okBg}>
                        <Icon name={record.status === "late" ? "schedule" : record.status === "absent" ? "person-off" : "check"} size={19} tint={record.status === "late" ? t.warn : record.status === "absent" ? t.bad : t.ok} />
                      </TonalTile>
                    }
                    title={formatDate(record.date)}
                    subtitle={`${formatText(record.status)}${record.checkInTime ? ` · in ${record.checkInTime}` : ""}${record.checkOutTime ? ` · out ${record.checkOutTime}` : ""}`}
                  />
                </View>
              ))
            )}
          </>
        ) : (
          <DSText variant="label">Attendance summary is unavailable right now.</DSText>
        )}
      </SectionCard>
    </ScrollView>
  );
}
