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

export function StaffScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const { profile } = useMobileSession();
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const { teachers, drivers, office, other, loading, error, refresh } = useStaffDirectory();
  const attendance = useTodayAttendance();
  const assignHref =
    workspaceForRole(profile?.role) === "principal" ? "/principal/tasks" : "/admin/tasks";
  const staffBase = dashboardPathForRole(profile?.role);
  const totalStaff = teachers.length + drivers.length + office.length + other.length;

  const visible = useMemo(() => {
    const matches = (member: AdminTeacher | StaffDriver | StaffOffice) =>
      matchesStaffFilter(member, filter) && matchesStaffQuery(member, query);
    const officeMembers = [...office, ...other].filter(
      (member, index, all) => all.findIndex((item) => item.id === member.id) === index
    );
    return {
      teaching: teachers.filter(matches),
      drivers: drivers.filter(matches),
      support: officeMembers.filter((member) => staffCategoryForOffice(member.role) === "support" && matches(member)),
      adminOffice: officeMembers.filter((member) => staffCategoryForOffice(member.role) === "office" && matches(member)),
      other: officeMembers.filter((member) => staffCategoryForOffice(member.role) === "other" && matches(member))
    };
  }, [teachers, drivers, office, other, filter, query]);

  const sections = useMemo(() => {
    const list: StaffSection[] = [];
    if (visible.teaching.length > 0) {
      list.push({ title: `TEACHING · ${visible.teaching.length}`, kind: "teacher", data: visible.teaching });
    }
    if (visible.drivers.length > 0) {
      list.push({ title: `DRIVERS · ${visible.drivers.length}`, kind: "driver", data: visible.drivers });
    }
    if (visible.support.length > 0) {
      list.push({ title: `SUPPORT · ${visible.support.length}`, kind: "office", data: visible.support });
    }
    if (visible.adminOffice.length > 0) {
      list.push({ title: `ADMIN/OFFICE · ${visible.adminOffice.length}`, kind: "office", data: visible.adminOffice });
    }
    if (visible.other.length > 0) {
      list.push({ title: `OTHER/UNASSIGNED · ${visible.other.length}`, kind: "office", data: visible.other });
    }
    return list;
  }, [visible]);

  if (loading && totalStaff === 0) return <SkeletonPage />;
  if (error && totalStaff === 0) return <ErrorState message={error} onRetry={refresh} />;

  const attendanceRate = attendance.total > 0 ? (attendance.present / attendance.total) * 100 : 0;

  // Virtualized sections: Teaching, Drivers, Support, Admin/Office, Other.
  return (
    <SectionList
      sections={sections}
      keyExtractor={(member) => member.id}
      stickySectionHeadersEnabled
      renderItem={({ item, section }) => {
        if (section.kind === "driver") {
          const driver = item as StaffDriver;
          const vehicle = driver.vehicleNo ?? driver.vehicle ?? "";
          return (
            <ListRow
              leading={<Avatar label={initials(driver.name ?? "?")} size={40} />}
              title={driver.name ?? "Driver"}
              subtitle={`${vehicle || "—"}${driver.licenseNo ? ` · ${driver.licenseNo}` : ""}${driver.phone ?? driver.mobile ? ` · ${driver.phone ?? driver.mobile}` : ""}`}
            />
          );
        }
        if (section.kind === "office") {
          const member = item as StaffOffice;
          const role = member.role ?? "";
          const roleLabel = role && role in ROLE_LABELS
            ? ROLE_LABELS[role as keyof typeof ROLE_LABELS]
            : role || "Unassigned";
          return (
            <ListRow
              leading={<Avatar label={initials(member.displayName ?? "?")} size={40} />}
              title={member.displayName ?? member.email ?? "Staff member"}
              subtitle={`${roleLabel}${member.email ? ` · ${member.email}` : ""}`}
            />
          );
        }
        const teacherMember = item as AdminTeacher;
        return (
          <ListRow
            leading={<Avatar label={initials(teacherMember.fullName ?? "?")} size={40} />}
            title={teacherMember.fullName ?? "Unnamed"}
            subtitle={`${teacherMember.subject ?? "—"}${teacherMember.employeeId ? ` · ${teacherMember.employeeId}` : ""}`}
            trailing={
              <Badge
                label={(teacherMember.status ?? "active") === "active" ? "Active" : "Inactive"}
                bg={(teacherMember.status ?? "active") === "active" ? t.okBg : t.line}
                fg={(teacherMember.status ?? "active") === "active" ? t.ok : t.mute}
              />
            }
            chevron
            onPress={() => router.push(`${staffBase}/staff/${teacherMember.id}` as never)}
          />
        );
      }}
      renderSectionHeader={({ section }) => (
        <View style={{ backgroundColor: t.bg, paddingTop: space.sm, paddingBottom: 2 }}>
          <DSText variant="overline" tint={t.mute}>{section.title}</DSText>
        </View>
      )}
      ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: t.line }]} />}
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={t.blue} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <PageTitle>Staff</PageTitle>

          <View style={styles.moneyGrid}>
            <View style={styles.moneyRow}>
              <Card style={styles.moneyCard}>
                <TonalTile bg={t.okBg} size={34}>
                  <Icon name="how-to-reg" size={18} tint={t.ok} />
                </TonalTile>
                <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
                  {attendance.present}
                </DSText>
                <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>PRESENT</DSText>
              </Card>
              <Card style={styles.moneyCard}>
                <TonalTile bg={t.warnBg} size={34}>
                  <Icon name="schedule" size={18} tint={t.warn} />
                </TonalTile>
                <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
                  {attendance.late}
                </DSText>
                <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>LATE</DSText>
              </Card>
            </View>
            <View style={styles.moneyRow}>
              <Card style={styles.moneyCard}>
                <TonalTile bg={t.badBg} size={34}>
                  <Icon name="person-off" size={18} tint={t.bad} />
                </TonalTile>
                <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
                  {attendance.absent}
                </DSText>
                <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>ABSENT</DSText>
              </Card>
              <Card style={styles.moneyCard}>
                <TonalTile bg={t.tint} size={34}>
                  <Icon name="groups" size={18} tint={t.blue} />
                </TonalTile>
                <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
                  {totalStaff}
                </DSText>
                <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>ON ROLL</DSText>
              </Card>
            </View>
          </View>

          <SectionCard heading="TODAY’S ATTENDANCE">
            <ProgressRow
              label="Staff present"
              percent={attendanceRate}
              valueLabel={`${attendance.present} / ${attendance.total}`}
              tint={attendanceRate >= 90 ? t.ok : t.warn}
            />
          </SectionCard>

          <TextField
            value={query}
            onChangeText={setQuery}
            placeholder="Search staff by name, role, ID or phone"
            accessibilityLabel="Search staff"
          />

          <FilterChips options={STAFF_FILTERS} value={filter} onChange={setFilter} />

          <PillButton
            label="Assign task"
            block
            bg={t.blue}
            fg="#FFFFFF"
            icon="add-task"
            onPress={() => router.push(assignHref as never)}
          />

          <DSText variant="label" tint={t.mute}>Search and status filters apply to every staff group.</DSText>
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          icon="groups"
          label={query.trim() ? "No staff match your search." : `No ${filter.toLowerCase()} staff to show.`}
        />
      }
      initialNumToRender={15}
      maxToRenderPerBatch={15}
      windowSize={7}
      removeClippedSubviews={true}
    />
  );
}
