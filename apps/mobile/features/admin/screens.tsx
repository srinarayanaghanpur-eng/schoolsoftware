/**
 * Shared management screens.
 *
 * Admin and Principal see the same staff / approvals / profile surfaces; the
 * only difference is the surrounding shell and its tab set. Keeping the bodies
 * here means one implementation instead of two drifting copies.
 */
import React, { useMemo, useState } from "react";
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Avatar, Badge, BottomSheet, Card, DSText, EmptyState, ErrorState, FilterChips, Icon, ListRow,
  SkeletonPage, PageTitle, PillButton, PressableScale, ProgressRow, SectionCard, TonalTile, useToast,
  type IconName
} from "@/design-system/components";
import { radius, space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import { useMobileSession } from "@/lib/mobileSession";
import { dashboardPathForRole, workspaceForRole, workspaceLabel } from "@/lib/roleRouting";
import { displayLoginContact } from "@/lib/text";
import { openWebsite } from "@/lib/openWebsite";
import { initials } from "@/features/teacher/hooks";
import { reviewLeaveRequest } from "./api";
import {
  formatDate, formatMoney, useDashboardStats, useLeaveRequests, useStaff,
  useTodayAttendance
} from "./hooks";

/* ------------------------------------------------------------------ Staff */

const STAFF_FILTERS = ["All", "Active", "Inactive"];

export function StaffScreen() {
  const { t } = useTheme();
  const [filter, setFilter] = useState("All");
  const { staff, loading, error, refresh } = useStaff();
  const attendance = useTodayAttendance();

  const visible = useMemo(() => {
    if (filter === "All") return staff;
    const wanted = filter.toLowerCase();
    return staff.filter((member) => (member.status ?? "active").toLowerCase() === wanted);
  }, [staff, filter]);

  if (loading && staff.length === 0) return <SkeletonPage />;
  if (error && staff.length === 0) return <ErrorState message={error} onRetry={refresh} />;

  const attendanceRate = attendance.total > 0 ? (attendance.present / attendance.total) * 100 : 0;

  // Virtualized: the directory holds every staff member, not just a page.
  return (
    <FlatList
      data={visible}
      keyExtractor={(member) => member.id}
      renderItem={({ item: member }) => (
        <ListRow
          leading={<Avatar label={initials(member.fullName ?? "?")} size={40} />}
          title={member.fullName ?? "Unnamed"}
          subtitle={`${member.subject ?? "—"}${member.employeeId ? ` · ${member.employeeId}` : ""}`}
          trailing={
            <Badge
              label={(member.status ?? "active") === "active" ? "Active" : "Inactive"}
              bg={(member.status ?? "active") === "active" ? t.okBg : t.line}
              fg={(member.status ?? "active") === "active" ? t.ok : t.mute}
            />
          }
        />
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
                  {staff.length}
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

          <FilterChips options={STAFF_FILTERS} value={filter} onChange={setFilter} />

          <DSText variant="overline">{`${visible.length} STAFF`}</DSText>
        </View>
      }
      ListEmptyComponent={
        <EmptyState icon="groups" label={`No ${filter.toLowerCase()} staff to show.`} />
      }
    />
  );
}

/* -------------------------------------------------------------- Approvals */

const APPROVAL_FILTERS = ["Pending", "Approved", "Rejected"];

export function ApprovalsScreen() {
  const { t } = useTheme();
  const toast = useToast();
  const [filter, setFilter] = useState("Pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const { requests, loading, error, refresh } = useLeaveRequests();

  const visible = useMemo(
    () => requests.filter((request) => (request.status ?? "pending") === filter.toLowerCase()),
    [requests, filter]
  );

  async function decide(requestId: string, status: "approved" | "rejected") {
    setBusyId(requestId);
    try {
      await reviewLeaveRequest(requestId, status);
      toast.show(status === "approved" ? "Leave approved ✓" : "Leave rejected");
      refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn’t update the request.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading && requests.length === 0) return <SkeletonPage />;
  if (error && requests.length === 0) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={t.blue} />}
    >
      <PageTitle>Approvals</PageTitle>

      <FilterChips options={APPROVAL_FILTERS} value={filter} onChange={setFilter} />

      {visible.length === 0 ? (
        <SectionCard heading={filter.toUpperCase()}>
          <EmptyState
            icon="fact-check"
            label={
              filter === "Pending"
                ? "Nothing waiting on you. All caught up."
                : `No ${filter.toLowerCase()} requests.`
            }
          />
        </SectionCard>
      ) : (
        visible.map((request) => (
          <SectionCard
            key={request.id}
            heading={(request.leaveType ?? "LEAVE").toUpperCase()}
            trailing={<DSText variant="caption">{formatDate(request.requestedAt)}</DSText>}
          >
            <ListRow
              leading={<Avatar label={initials(request.teacherName ?? "?")} size={40} />}
              title={request.teacherName ?? "Staff member"}
              subtitle={`${formatDate(request.fromDate)} – ${formatDate(request.toDate)}`}
            />
            {request.reason ? (
              <DSText variant="body" style={{ marginTop: space.xs }}>{request.reason}</DSText>
            ) : null}

            {filter === "Pending" ? (
              <View style={styles.decisionRow}>
                <View style={{ flex: 1 }}>
                  <PillButton
                    label={busyId === request.id ? "Saving…" : "Approve"}
                    block
                    icon="check"
                    bg={t.blue}
                    fg="#FFFFFF"
                    onPress={() => { if (!busyId) void decide(request.id, "approved"); }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <PillButton
                    label="Reject"
                    block
                    icon="close"
                    bg={t.badBg}
                    fg={t.bad}
                    onPress={() => { if (!busyId) void decide(request.id, "rejected"); }}
                  />
                </View>
              </View>
            ) : null}
          </SectionCard>
        ))
      )}
    </ScrollView>
  );
}

/* ---------------------------------------------------------------- Profile */

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
        <Card style={styles.moneyCard}>
          <TonalTile bg={t.tint} size={34}>
            <Icon name="school" size={18} tint={t.blue} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {stats?.totalStudents ?? 0}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>STUDENTS</DSText>
        </Card>
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

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, paddingTop: space.md, gap: 14 },
  header: { gap: 14 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 56 },
  divider: { height: StyleSheet.hairlineWidth },
  statRow: { flexDirection: "row", gap: space.sm },
  moneyGrid: { gap: 10 },
  moneyRow: { flexDirection: "row", gap: 10 },
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
  identityRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 10 },
  decisionRow: { flexDirection: "row", gap: space.md, marginTop: space.md },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionPress: { flex: 1, minWidth: "46%" },
  actionTile: { gap: 8 },
  actionLabel: { fontWeight: "700" }
});
