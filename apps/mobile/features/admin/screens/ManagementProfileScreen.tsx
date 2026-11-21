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

export function ManagementProfileScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const session = useMobileSession();
  const { stats } = useDashboardStats();
  const attendance = useTodayAttendance();

  const name = session.profile?.displayName ?? "Administrator";
  /**
   * Only link to routes that exist in THIS workspace — an accountant has no
   * /accountant/staff, a principal has no /principal/fees. Building the menu
   * from the workspace kind keeps every link reachable.
   */
  const workspace = workspaceForRole(session.profile?.role);
  const base = dashboardPathForRole(session.profile?.role);
  const manageLinks: { icon: IconName; title: string; href: string }[] =
    workspace === "accountant"
      ? [
          { icon: "receipt-long", title: "Collections", href: `${base}/collections` },
          { icon: "schedule", title: "Outstanding dues", href: `${base}/dues` }
        ]
      : workspace === "principal"
        ? [
            { icon: "groups", title: "Staff directory", href: `${base}/staff` },
            { icon: "fact-check", title: "Leave approvals", href: `${base}/approvals` }
          ]
        : [
            { icon: "groups", title: "Staff directory", href: `${base}/staff` },
            { icon: "fact-check", title: "Leave approvals", href: `${base}/approvals` },
            { icon: "payments", title: "Fee collection", href: `${base}/fees` },
            { icon: "campaign", title: "Notices", href: `${base}/notices` }
          ];

  const tileForIndex = (index: number) => {
    const tones = [
      { bg: t.tint, tint: t.blue },
      { bg: t.warnBg, tint: t.warn },
      { bg: t.okBg, tint: t.ok },
      { bg: t.tint, tint: t.blue }
    ];
    return tones[index % tones.length];
  };

  const logout = async () => {
    try {
      await session.logout();
      router.replace("/login" as never);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Logout failed. Please try again.");
    }
  };

  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmLogout = () => setConfirmOpen(true);

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.identityRow}>
        <Avatar label={initials(name)} size={64} bg={t.blue} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <DSText variant="title" style={{ fontSize: 19 }} numberOfLines={1}>{name}</DSText>
          <DSText variant="label">{workspaceLabel(session.profile?.role)}</DSText>
          <DSText variant="label">
            {displayLoginContact(session.profile)}
          </DSText>
        </View>
      </View>

      <View style={styles.statRow}>
        <PressableScale
          accessibilityLabel="Open students"
          onPress={() => router.push(`${base}/students` as never)}
          style={styles.moneyPress}
        >
          <Card style={styles.moneyCard}>
            <TonalTile bg={t.tint} size={34}>
              <Icon name="school" size={18} tint={t.blue} />
            </TonalTile>
            <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
              {stats?.totalStudents ?? 0}
            </DSText>
            <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>STUDENTS</DSText>
          </Card>
        </PressableScale>
        <Card style={styles.moneyCard}>
          <TonalTile bg={t.tint} size={34}>
            <Icon name="groups" size={18} tint={t.blue} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {attendance.total}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>STAFF</DSText>
        </Card>
        <Card style={styles.moneyCard}>
          <TonalTile bg={t.okBg} size={34}>
            <Icon name="payments" size={18} tint={t.ok} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {formatMoney(stats?.monthlyCollection)}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>THIS MONTH</DSText>
        </Card>
      </View>

      <DSText variant="overline">MANAGE</DSText>
      <View style={styles.actionGrid}>
        {manageLinks.map((link, index) => {
          const tile = tileForIndex(index);
          return (
            <PressableScale
              key={link.href}
              accessibilityLabel={link.title}
              onPress={() => router.push(link.href as never)}
              style={styles.actionPress}
            >
              <Card style={styles.actionTile}>
                <TonalTile bg={tile.bg} size={36}>
                  <Icon name={link.icon} size={19} tint={tile.tint} />
                </TonalTile>
                <DSText variant="bodyMedium" numberOfLines={2} style={styles.actionLabel}>{link.title}</DSText>
                <DSText variant="label" tint={t.blue}>
                  Open →
                </DSText>
              </Card>
            </PressableScale>
          );
        })}
      </View>

      <DSText variant="overline">MORE</DSText>
      <View style={styles.actionGrid}>
        <PressableScale
          accessibilityLabel="Reports and exports"
          onPress={() => openWebsite("/admin/reports", "Reports & exports")}
          style={styles.actionPress}
        >
          <Card style={styles.actionTile}>
            <TonalTile bg={t.tint} size={36}>
              <Icon name="insights" size={19} tint={t.blue} />
            </TonalTile>
            <DSText variant="bodyMedium" style={styles.actionLabel}>Reports & exports</DSText>
            <DSText variant="label">Opens the website in your browser</DSText>
            <DSText variant="label" tint={t.blue}>
              Open →
            </DSText>
          </Card>
        </PressableScale>
        <PressableScale
          accessibilityLabel="Help and support"
          onPress={() => router.push("/support" as never)}
          style={styles.actionPress}
        >
          <Card style={styles.actionTile}>
            <TonalTile bg={t.warnBg} size={36}>
              <Icon name="help-outline" size={19} tint={t.warn} />
            </TonalTile>
            <DSText variant="bodyMedium" style={styles.actionLabel}>Help & support</DSText>
            <DSText variant="label">Contact your administrator</DSText>
            <DSText variant="label" tint={t.blue}>
              Contact →
            </DSText>
          </Card>
        </PressableScale>
      </View>

      <PillButton label="Logout from this device" block bg={t.bad} fg="#FFFFFF" icon="logout" onPress={confirmLogout} />

      <BottomSheet
        visible={confirmOpen}
        title="Log out?"
        onClose={() => setConfirmOpen(false)}
      >
        <DSText variant="label">You are getting logged out from this device.</DSText>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
          <View style={{ flex: 1 }}>
            <PillButton label="Stay" block onPress={() => setConfirmOpen(false)} />
          </View>
          <View style={{ flex: 1 }}>
            <PillButton
              label="Log out"
              block
              bg={t.bad}
              fg="#FFFFFF"
              onPress={() => { setConfirmOpen(false); void logout(); }}
            />
          </View>
        </View>
      </BottomSheet>
    </ScrollView>
  );
}
