/**
 * Principal Home — staff-first snapshot, per the approved Principal App design.
 * The principal's daily job is people and approvals, so staff attendance leads
 * and fee figures are secondary (the reverse of the Admin home).
 */
import React from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Avatar, Badge, Card, DSText, ErrorState, Icon, ListRow, SkeletonPage,
  PillButton, PressableScale, ProgressRow, ScreenHeader, SectionCard, TonalTile, useToast
} from "@/design-system/components";
import { radius, space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import { useMobileSession } from "@/lib/mobileSession";
import { PrincipalShell } from "@/features/admin/shell";
import {
  formatDate, formatMoneyShort, useDashboardStats, useLeaveRequests, useNotices,
  useStaff, useTodayAttendance
} from "@/features/admin/hooks";
import { dateLabel, greeting, initials } from "@/features/teacher/hooks";

const QUICK_ACTIONS = [
  { key: "staff", icon: "groups" as const, label: "Staff", href: "/principal/staff", tone: "info" as const },
  { key: "approvals", icon: "fact-check" as const, label: "Approvals", href: "/principal/approvals", tone: "warn" as const },
  { key: "attendance", icon: "how-to-reg" as const, label: "Attendance", href: "/principal/staff", tone: "ok" as const },
  { key: "profile", icon: "person-outline" as const, label: "Profile", href: "/principal/profile", tone: "info" as const }
];

export default function PrincipalHomeRoute() {
  return (
    <PrincipalShell>
      <PrincipalHome />
    </PrincipalShell>
  );
}

function PrincipalHome() {
  const { t } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { profile } = useMobileSession();
  const attendance = useTodayAttendance();
  const { staff } = useStaff();
  const { requests } = useLeaveRequests();
  const { notices } = useNotices();
  const { stats, loading, error, refresh } = useDashboardStats();

  if (attendance.loading && attendance.total === 0 && !stats) {
    return <SkeletonPage />;
  }
  if (error && !stats) return <ErrorState message={error} onRetry={refresh} />;

  const name = profile?.displayName ?? "Principal";
  const pendingLeave = requests.filter((r) => r.status === "pending");
  const attendanceRate = attendance.total > 0 ? (attendance.present / attendance.total) * 100 : 0;

  const tileFor = (tone: "ok" | "warn" | "info") => {
    if (tone === "ok") return { bg: t.okBg, tint: t.ok };
    if (tone === "warn") return { bg: t.warnBg, tint: t.warn };
    return { bg: t.tint, tint: t.blue };
  };

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={attendance.loading}
          onRefresh={() => { attendance.refresh(); refresh(); }}
          tintColor={t.blue}
        />
      }
    >
      <ScreenHeader
        eyebrow={`${greeting()} · ${dateLabel()}`}
        title={name}
        trailing={
          <PressableScale accessibilityLabel="Profile" onPress={() => router.push("/principal/profile" as never)}>
            <Avatar label={initials(name)} size={42} bg={t.blue} />
          </PressableScale>
        }
      />

      {/* staff attendance hero — blue gradient */}
      <LinearGradient
        colors={[t.heroFrom, t.heroMid, t.heroTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroCircle} pointerEvents="none" />
        <View style={styles.heroTop}>
          <TonalTile bg="rgba(255,255,255,0.18)" size={40}>
            <Icon name="groups" size={22} tint="#FFFFFF" />
          </TonalTile>
          <View style={{ flex: 1, minWidth: 0 }}>
            <DSText variant="bodyMedium" tint="#FFFFFF">
              {attendance.present} of {attendance.total} staff present
            </DSText>
            <DSText variant="label" tint="rgba(255,255,255,0.8)">
              {attendance.late} late · {attendance.absent} absent
            </DSText>
          </View>
          <PillButton
            label="View"
            bg="#FFFFFF"
            fg={t.blue}
            onPress={() => router.push("/principal/staff" as never)}
          />
        </View>
      </LinearGradient>

      <View style={styles.statRow}>
        <Card style={styles.moneyCard}>
          <TonalTile bg={t.tint} size={36}>
            <Icon name="groups" size={19} tint={t.blue} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {staff.length}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>ON ROLL</DSText>
        </Card>
        <Card style={styles.moneyCard}>
          <TonalTile bg={t.tint} size={36}>
            <Icon name="school" size={19} tint={t.blue} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {stats?.totalStudents ?? 0}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>STUDENTS</DSText>
        </Card>
        <Card style={styles.moneyCard}>
          <TonalTile bg={pendingLeave.length > 0 ? t.warnBg : t.okBg} size={36}>
            <Icon name="fact-check" size={19} tint={pendingLeave.length > 0 ? t.warn : t.ok} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {pendingLeave.length}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>AWAITING</DSText>
        </Card>
      </View>

      {/* assign a task prompt (staff task assignment — Phase 2) */}
      <LinearGradient
        colors={[t.heroFrom, t.heroMid, t.heroTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroCircle} pointerEvents="none" />
        <View style={styles.heroTop}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <DSText variant="bodyMedium" tint="#FFFFFF" style={styles.promptTitle}>Assign a task</DSText>
            <DSText variant="label" tint="rgba(255,255,255,0.8)" style={styles.promptMeta}>Delegate work to any teacher in seconds</DSText>
          </View>
          <PillButton
            label="New task"
            icon="add-task"
            bg="#FFFFFF"
            fg={t.blue}
            onPress={() => toast.show("Task assignment arrives in the next release.")}
          />
        </View>
      </LinearGradient>

      <SectionCard heading="TODAY’S ATTENDANCE">
        <ProgressRow
          label="Staff present"
          percent={attendanceRate}
          valueLabel={`${Math.round(attendanceRate)}%`}
          tint={attendanceRate >= 90 ? t.ok : t.warn}
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
              {index > 0 ? <View style={[styles.divider, { backgroundColor: t.line }]} /> : null}
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
        {QUICK_ACTIONS.map((action) => {
          const tile = tileFor(action.tone);
          return (
            <PressableScale
              key={action.key}
              accessibilityLabel={action.label}
              onPress={() => router.push(action.href as never)}
              style={[styles.quickTile, { backgroundColor: t.card, borderColor: t.line }]}
            >
              <TonalTile bg={tile.bg} size={38}>
                <Icon name={action.icon} size={22} tint={tile.tint} />
              </TonalTile>
              <DSText variant="caption" tint={t.mute} style={{ fontWeight: "500" }}>{action.label}</DSText>
            </PressableScale>
          );
        })}
      </View>

      {/* notices */}
      <SectionCard heading="RECENT NOTICES">
        {notices.length === 0 ? (
          <DSText variant="label">No notices published yet.</DSText>
        ) : (
          notices.slice(0, 3).map((notice, index) => (
            <View key={notice.id}>
              {index > 0 ? <View style={[styles.divider, { backgroundColor: t.line }]} /> : null}
              <ListRow
                leading={<TonalTile bg={t.tint}><Icon name="campaign" size={19} tint={t.blue} /></TonalTile>}
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
        style={[styles.broadcast, { backgroundColor: t.card, borderColor: t.line }]}
      >
        <TonalTile bg={t.tint} size={34}>
          <Icon name="campaign" size={19} tint={t.blue} />
        </TonalTile>
        <DSText variant="bodyMedium" tint={t.blue}>Send announcement to all staff</DSText>
      </PressableScale>

      {/* fee position — secondary for this role */}
      <SectionCard heading="FEE POSITION">
        <ListRow
          leading={<TonalTile bg={t.okBg}><Icon name="trending-up" size={19} tint={t.ok} /></TonalTile>}
          title={formatMoneyShort(stats?.totalFeeCollected)}
          subtitle="Collected to date"
        />
        <View style={[styles.divider, { backgroundColor: t.line }]} />
        <ListRow
          leading={<TonalTile bg={t.badBg}><Icon name="error-outline" size={19} tint={t.bad} /></TonalTile>}
          title={formatMoneyShort(stats?.totalFeeOutstanding)}
          subtitle={`${stats?.studentsWithOutstandingFees ?? 0} students with dues`}
        />
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, paddingTop: space.md, gap: 14 },
  hero: { borderRadius: radius.xl, padding: space.lg, paddingHorizontal: 18, overflow: "hidden" },
  heroCircle: {
    position: "absolute",
    top: -70,
    right: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.16)"
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 14 },
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
  divider: { height: StyleSheet.hairlineWidth },
  promptTitle: { fontSize: 15, fontWeight: "700" },
  promptMeta: { marginTop: 2 },
  quickGrid: { flexDirection: "row", gap: 10 },
  quickTile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: space.md + 2,
    paddingHorizontal: space.xs,
    alignItems: "center",
    gap: space.sm
  },
  broadcast: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm
  }
});
