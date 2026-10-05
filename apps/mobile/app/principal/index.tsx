/**
 * Principal Home — staff-first snapshot, per the approved Principal App design.
 * The principal's daily job is people and approvals, so staff attendance leads
 * and fee figures are secondary (the reverse of the Admin home).
 */
import React from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Avatar, Badge, Card, DSText, ErrorState, Hero, Icon, ListRow, LoadingState,
  PillButton, PressableScale, ProgressRow, ScreenHeader, SectionCard, TonalTile, useToast
} from "@/design-system/components";
import { color, elevation, radius, space } from "@/design-system/tokens";
import { useMobileSession } from "@/lib/mobileSession";
import { PrincipalShell } from "@/features/admin/shell";
import {
  formatDate, formatMoneyShort, useDashboardStats, useLeaveRequests, useNotices,
  useStaff, useTodayAttendance
} from "@/features/admin/hooks";
import { dateLabel, greeting, initials } from "@/features/teacher/hooks";

const QUICK_ACTIONS = [
  { key: "staff", icon: "groups" as const, label: "Staff", href: "/principal/staff", tile: color.tileSky, tint: color.primary },
  { key: "approvals", icon: "fact-check" as const, label: "Approvals", href: "/principal/approvals", tile: color.tilePeach, tint: color.warning },
  { key: "attendance", icon: "how-to-reg" as const, label: "Attendance", href: "/principal/staff", tile: color.tileMint, tint: color.success },
  { key: "profile", icon: "person-outline" as const, label: "Profile", href: "/principal/profile", tile: color.tileLavender, tint: color.primary }
];

export default function PrincipalHomeRoute() {
  return (
    <PrincipalShell>
      <PrincipalHome />
    </PrincipalShell>
  );
}

function PrincipalHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { profile } = useMobileSession();
  const attendance = useTodayAttendance();
  const { staff } = useStaff();
  const { requests } = useLeaveRequests();
  const { notices } = useNotices();
  const { stats, loading, error, refresh } = useDashboardStats();

  if (attendance.loading && attendance.total === 0 && !stats) {
    return <LoadingState label="Loading today’s snapshot…" />;
  }
  if (error && !stats) return <ErrorState message={error} onRetry={refresh} />;

  const name = profile?.displayName ?? "Principal";
  const pendingLeave = requests.filter((r) => r.status === "pending");
  const attendanceRate = attendance.total > 0 ? (attendance.present / attendance.total) * 100 : 0;

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xs }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={attendance.loading}
          onRefresh={() => { attendance.refresh(); refresh(); }}
          tintColor={color.primary}
        />
      }
    >
      <ScreenHeader
        eyebrow={`${greeting()} · ${dateLabel()}`}
        title={name}
        trailing={
          <PressableScale accessibilityLabel="Profile" onPress={() => router.push("/principal/profile" as never)}>
            <Avatar label={initials(name)} size={42} bg={color.accountPurple} />
          </PressableScale>
        }
      />

      {/* staff attendance hero */}
      <Hero tone={attendanceRate >= 90 ? "success" : "primary"}>
        <TonalTile
          bg={attendanceRate >= 90 ? color.success : "rgba(255,255,255,0.18)"}
          size={40}
        >
          <Icon name="groups" size={22} tint={color.onPrimary} />
        </TonalTile>
        <View style={{ flex: 1, minWidth: 0 }}>
          <DSText
            variant="bodyMedium"
            tint={attendanceRate >= 90 ? color.onSuccessContainer : color.onPrimary}
          >
            {attendance.present} of {attendance.total} staff present
          </DSText>
          <DSText
            variant="label"
            tint={attendanceRate >= 90 ? color.success : color.onPrimary}
          >
            {attendance.late} late · {attendance.absent} absent
          </DSText>
        </View>
        <PillButton
          label="View"
          bg={attendanceRate >= 90 ? color.successContainer : color.surface}
          fg={attendanceRate >= 90 ? color.success : color.onPrimaryContainer}
          onPress={() => router.push("/principal/staff" as never)}
        />
      </Hero>

      <View style={styles.statRow}>
        <Card style={styles.moneyCard}>
          <TonalTile bg={color.tileSky} size={36}>
            <Icon name="groups" size={19} tint={color.primary} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {staff.length}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>ON ROLL</DSText>
        </Card>
        <Card style={styles.moneyCard}>
          <TonalTile bg={color.tileLavender} size={36}>
            <Icon name="school" size={19} tint={color.primary} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {stats?.totalStudents ?? 0}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>STUDENTS</DSText>
        </Card>
        <Card style={styles.moneyCard}>
          <TonalTile bg={pendingLeave.length > 0 ? color.tilePeach : color.tileMint} size={36}>
            <Icon name="fact-check" size={19} tint={pendingLeave.length > 0 ? color.warning : color.success} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {pendingLeave.length}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>AWAITING</DSText>
        </Card>
      </View>

      {/* assign a task prompt (staff task assignment — Phase 2) */}
      <Hero>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.promptTitle}>Assign a task</Text>
          <Text style={styles.promptMeta}>Delegate work to any teacher in seconds</Text>
        </View>
        <PillButton
          label="New task"
          icon="add-task"
          bg={color.surface}
          fg={color.onPrimaryContainer}
          onPress={() => toast.show("Task assignment arrives in the next release.")}
        />
      </Hero>

      <SectionCard heading="TODAY’S ATTENDANCE">
        <ProgressRow
          label="Staff present"
          percent={attendanceRate}
          valueLabel={`${Math.round(attendanceRate)}%`}
          tint={attendanceRate >= 90 ? color.success : color.warning}
        />
      </SectionCard>

      {/* approvals */}
      <SectionCard
        heading="LEAVE APPROVALS"
        trailing={pendingLeave.length > 0 ? <Badge label={`${pendingLeave.length}`} /> : undefined}
      >
        {pendingLeave.length === 0 ? (
          <DSText variant="label">Nothing waiting on you. All caught up.</DSText>
        ) : (
          pendingLeave.slice(0, 3).map((request, index) => (
            <View key={request.id}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <ListRow
                leading={<Avatar label={initials(request.teacherName ?? "?")} size={38} />}
                title={request.teacherName ?? "Staff leave request"}
                subtitle={`${request.leaveType ?? "Leave"} · ${formatDate(request.fromDate)}`}
                chevron
                onPress={() => router.push("/principal/approvals" as never)}
              />
            </View>
          ))
        )}
      </SectionCard>

      {/* quick actions */}
      <View style={styles.quickGrid}>
        {QUICK_ACTIONS.map((action) => (
          <PressableScale
            key={action.key}
            accessibilityLabel={action.label}
            onPress={() => router.push(action.href as never)}
            style={styles.quickTile}
          >
            <TonalTile bg={action.tile} size={38}>
              <Icon name={action.icon} size={22} tint={action.tint} />
            </TonalTile>
            <DSText variant="caption" tint={color.ink2} style={{ fontWeight: "500" }}>{action.label}</DSText>
          </PressableScale>
        ))}
      </View>

      {/* notices */}
      <SectionCard heading="RECENT NOTICES">
        {notices.length === 0 ? (
          <DSText variant="label">No notices published yet.</DSText>
        ) : (
          notices.slice(0, 3).map((notice, index) => (
            <View key={notice.id}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <ListRow
                leading={<TonalTile bg={color.tileLavender}><Icon name="campaign" size={19} tint={color.primary} /></TonalTile>}
                title={notice.title ?? "Untitled notice"}
                subtitle={`${notice.audience ?? "All"} · ${formatDate(notice.createdAt)}`}
              />
            </View>
          ))
        )}
      </SectionCard>

      {/* broadcast (staff announcements — Phase 2) */}
      <PressableScale
        accessibilityLabel="Send announcement to all staff"
        onPress={() => toast.show("Staff announcements arrive in the next release.")}
        style={styles.broadcast}
      >
        <TonalTile bg={color.tileLavender} size={34}>
          <Icon name="campaign" size={19} tint={color.primary} />
        </TonalTile>
        <DSText variant="bodyMedium" tint={color.primary}>Send announcement to all staff</DSText>
      </PressableScale>

      {/* fee position — secondary for this role */}
      <SectionCard heading="FEE POSITION">
        <ListRow
          leading={<TonalTile bg={color.tileMint}><Icon name="trending-up" size={19} tint={color.success} /></TonalTile>}
          title={formatMoneyShort(stats?.totalFeeCollected)}
          subtitle="Collected to date"
        />
        <View style={styles.divider} />
        <ListRow
          leading={<TonalTile bg={color.tileRose}><Icon name="error-outline" size={19} tint={color.error} /></TonalTile>}
          title={formatMoneyShort(stats?.totalFeeOutstanding)}
          subtitle={`${stats?.studentsWithOutstandingFees ?? 0} students with dues`}
        />
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 },
  statRow: { flexDirection: "row", gap: 10 },
  moneyCard: {
    flex: 1,
    padding: space.md,
    paddingHorizontal: space.sm,
    alignItems: "flex-start",
    gap: 6,
    borderRadius: radius.lg,
    ...elevation.card
  },
  moneyValue: { fontSize: 17, fontWeight: "800" },
  moneyLabel: { fontSize: 10 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: color.outline },
  promptTitle: { fontSize: 15, fontWeight: "700", color: color.onPrimary },
  promptMeta: { fontSize: 12.5, color: color.onPrimary, opacity: 0.8, marginTop: 2 },
  quickGrid: { flexDirection: "row", gap: 10 },
  quickTile: {
    flex: 1,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.outline,
    borderRadius: radius.lg,
    paddingVertical: space.md + 2,
    paddingHorizontal: space.xs,
    alignItems: "center",
    gap: space.sm,
    ...elevation.card
  },
  broadcast: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.outline,
    borderRadius: radius.lg,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    ...elevation.card
  }
});
