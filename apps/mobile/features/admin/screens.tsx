/**
 * Shared management screens.
 *
 * Admin and Principal see the same staff / approvals / profile surfaces; the
 * only difference is the surrounding shell and its tab set. Keeping the bodies
 * here means one implementation instead of two drifting copies.
 */
import React, { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Avatar, Badge, DSText, EmptyState, ErrorState, FilterChips, Icon, ListRow,
  LoadingState, PageTitle, PillButton, ProgressRow, SectionCard, StatTile, useToast,
  type IconName
} from "@/design-system/components";
import { color, space } from "@/design-system/tokens";
import { useMobileSession } from "@/lib/mobileSession";
import { dashboardPathForRole, workspaceForRole, workspaceLabel } from "@/lib/roleRouting";
import { initials } from "@/features/teacher/hooks";
import { reviewLeaveRequest } from "./api";
import {
  formatDate, formatMoney, useDashboardStats, useLeaveRequests, useStaff,
  useTodayAttendance
} from "./hooks";

/* ------------------------------------------------------------------ Staff */

const STAFF_FILTERS = ["All", "Active", "Inactive"];

export function StaffScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState("All");
  const { staff, loading, error, refresh } = useStaff();
  const attendance = useTodayAttendance();

  const visible = useMemo(() => {
    if (filter === "All") return staff;
    const wanted = filter.toLowerCase();
    return staff.filter((member) => (member.status ?? "active").toLowerCase() === wanted);
  }, [staff, filter]);

  if (loading && staff.length === 0) return <LoadingState label="Loading staff…" />;
  if (error && staff.length === 0) return <ErrorState message={error} onRetry={refresh} />;

  const attendanceRate = attendance.total > 0 ? (attendance.present / attendance.total) * 100 : 0;

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xs }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={color.primary} />}
    >
      <PageTitle>Staff</PageTitle>

      <View style={styles.statRow}>
        <StatTile value={attendance.present} label="Present today" tint={color.success} />
        <StatTile value={attendance.late} label="Late" tint={color.warning} />
        <StatTile value={attendance.absent} label="Absent" tint={color.error} />
        <StatTile value={staff.length} label="On roll" tint={color.primary} />
      </View>

      <SectionCard heading="TODAY’S ATTENDANCE">
        <ProgressRow
          label="Staff present"
          percent={attendanceRate}
          valueLabel={`${attendance.present} / ${attendance.total}`}
          tint={attendanceRate >= 90 ? color.success : color.warning}
        />
      </SectionCard>

      <FilterChips options={STAFF_FILTERS} value={filter} onChange={setFilter} />

      <SectionCard heading={`${visible.length} STAFF`}>
        {visible.length === 0 ? (
          <EmptyState icon="groups" label={`No ${filter.toLowerCase()} staff to show.`} />
        ) : (
          visible.map((member) => (
            <ListRow
              key={member.id}
              leading={<Avatar label={initials(member.fullName ?? "?")} size={40} />}
              title={member.fullName ?? "Unnamed"}
              subtitle={`${member.subject ?? "—"}${member.employeeId ? ` · ${member.employeeId}` : ""}`}
              trailing={
                <Badge
                  label={(member.status ?? "active") === "active" ? "Active" : "Inactive"}
                  bg={(member.status ?? "active") === "active" ? color.successContainer : color.surfaceVariant}
                  fg={(member.status ?? "active") === "active" ? color.onSuccessContainer : color.ink2}
                />
              }
            />
          ))
        )}
      </SectionCard>
    </ScrollView>
  );
}

/* -------------------------------------------------------------- Approvals */

const APPROVAL_FILTERS = ["Pending", "Approved", "Rejected"];

export function ApprovalsScreen() {
  const insets = useSafeAreaInsets();
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

  if (loading && requests.length === 0) return <LoadingState label="Loading approvals…" />;
  if (error && requests.length === 0) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xs }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={color.primary} />}
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
                    bg={color.successContainer}
                    fg={color.onSuccessContainer}
                    onPress={() => { if (!busyId) void decide(request.id, "approved"); }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <PillButton
                    label="Reject"
                    block
                    icon="close"
                    bg={color.errorContainer}
                    fg={color.error}
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
  const insets = useSafeAreaInsets();
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

  const logout = async () => {
    try {
      await session.logout();
      router.replace("/login" as never);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Logout failed. Please try again.");
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.sm }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.identityRow}>
        <Avatar label={initials(name)} size={64} bg={color.accountPurple} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <DSText variant="title" style={{ fontSize: 19 }} numberOfLines={1}>{name}</DSText>
          <DSText variant="label">{workspaceLabel(session.profile?.role)}</DSText>
          <DSText variant="label">
            {session.profile?.email ?? session.profile?.employeeId ?? ""}
          </DSText>
        </View>
      </View>

      <View style={styles.statRow}>
        <StatTile value={stats?.totalStudents ?? 0} label="Students" tint={color.primary} />
        <StatTile value={attendance.total} label="Staff" tint={color.accountPurple} />
        <StatTile value={formatMoney(stats?.monthlyCollection)} label="This month" tint={color.success} />
      </View>

      <SectionCard heading="MANAGE">
        {manageLinks.map((link) => (
          <ListRow
            key={link.href}
            leading={<Icon name={link.icon} size={21} tint={color.primary} />}
            title={link.title}
            chevron
            onPress={() => router.push(link.href as never)}
          />
        ))}
      </SectionCard>

      <SectionCard heading="MORE">
        <ListRow
          leading={<Icon name="insights" size={21} tint={color.primary} />}
          title="Reports & exports"
          subtitle="Available in the web dashboard"
          chevron
          onPress={() => toast.show("Open the web dashboard for full reports.")}
        />
        <ListRow
          leading={<Icon name="help-outline" size={21} tint={color.primary} />}
          title="Help & support"
          chevron
          onPress={() => toast.show("Contact your system administrator.")}
        />
      </SectionCard>

      <PillButton label="Logout from this device" block bg={color.error} icon="logout" onPress={logout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 },
  statRow: { flexDirection: "row", gap: space.sm },
  identityRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 10 },
  decisionRow: { flexDirection: "row", gap: space.md, marginTop: space.md }
});
