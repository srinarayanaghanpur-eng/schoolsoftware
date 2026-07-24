/**
 * Admin Home — today's snapshot, per the approved Admin App design.
 * All figures come from /api/admin/* (server-side RBAC); nothing is hardcoded.
 */
import React, { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Avatar, Badge, DSText, ErrorState, FullScreenPanel, Hero, Icon, ListRow,
  LoadingState, PillButton, PressableScale, ProgressRow, ScreenHeader,
  SectionCard, StatTile, TonalTile, useToast
} from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { useMobileSession } from "@/lib/mobileSession";
import { AdminShell } from "@/features/admin/shell";
import {
  formatDate, formatMoney, formatMoneyShort, useBusFinance, useDashboardStats,
  useLeaveRequests, useRecentPayments, useTodayAttendance
} from "@/features/admin/hooks";
import {
  fetchBusEmiSchedule, markBusEmiPaid, type BusEmiPayment, type BusFinanceRecord
} from "@/features/admin/api";
import { dateLabel, greeting, initials } from "@/features/teacher/hooks";

const QUICK_ACTIONS = [
  { key: "fees", icon: "payments" as const, label: "Fees", href: "/admin/fees" },
  { key: "staff", icon: "groups" as const, label: "Staff", href: "/admin/staff" },
  { key: "approvals", icon: "fact-check" as const, label: "Approvals", href: "/admin/approvals" },
  { key: "notices", icon: "campaign" as const, label: "Notices", href: "/admin/notices" }
];

export default function AdminHomeRoute() {
  return (
    <AdminShell>
      <AdminHome />
    </AdminShell>
  );
}

function AdminHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { profile } = useMobileSession();
  const { stats, loading, error, refresh } = useDashboardStats();
  const attendance = useTodayAttendance();
  const { payments } = useRecentPayments();
  const { requests } = useLeaveRequests();
  const busFinance = useBusFinance();
  const [busPanelOpen, setBusPanelOpen] = useState(false);
  const [selectedBus, setSelectedBus] = useState<BusFinanceRecord | null>(null);
  const [schedule, setSchedule] = useState<BusEmiPayment[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  if (loading && !stats) return <LoadingState label="Loading today’s snapshot…" />;
  if (error && !stats) return <ErrorState message={error} onRetry={refresh} />;

  const name = profile?.displayName ?? "Administrator";
  const pendingLeave = requests.filter((r) => r.status === "pending");
  const collectionRate = stats && stats.totalFeeAmount > 0
    ? (stats.totalFeeCollected / stats.totalFeeAmount) * 100
    : 0;
  const activeBuses = busFinance.buses.filter((bus) => bus.status !== "closed" && bus.status !== "cancelled");
  const monthlyBusEmi = activeBuses.reduce((sum, bus) => sum + Number(bus.emiAmount ?? 0), 0);
  const overdueBuses = activeBuses.filter((bus) => bus.status === "overdue").length;

  const openBus = async (bus: BusFinanceRecord) => {
    setSelectedBus(bus);
    setScheduleLoading(true);
    try {
      setSchedule(await fetchBusEmiSchedule(bus.id));
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Unable to load EMI schedule.");
      setSchedule([]);
    } finally {
      setScheduleLoading(false);
    }
  };

  const payEmi = async (payment: BusEmiPayment) => {
    setPayingId(payment.id);
    try {
      await markBusEmiPaid(payment.id, {
        paidAmount: Number(payment.emiAmount ?? 0),
        paymentMode: "bank_transfer"
      });
      toast.show(`${formatMoney(payment.emiAmount)} recorded for ${payment.vehicleNumber ?? "bus"} ✓`);
      if (selectedBus) await openBus(selectedBus);
      busFinance.refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Unable to record payment.");
    } finally {
      setPayingId(null);
    }
  };

  return (
    <>
      <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xs }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={color.primary} />}
    >
      <ScreenHeader
        eyebrow={`${greeting()} · ${dateLabel()}`}
        title={name}
        trailing={
          <PressableScale accessibilityLabel="Profile" onPress={() => router.push("/admin/profile" as never)}>
            <Avatar label={initials(name)} size={42} bg={color.accountPurple} />
          </PressableScale>
        }
      />

      {/* collections hero */}
      <Hero>
        <View style={{ flex: 1, minWidth: 0 }}>
          <DSText variant="caption" tint={color.onPrimary} style={{ opacity: 0.8 }}>
            COLLECTED THIS MONTH
          </DSText>
          <DSText variant="display" tint={color.onPrimary} style={{ fontSize: 26 }}>
            {formatMoney(stats?.monthlyCollection)}
          </DSText>
        </View>
        <PillButton
          label="Details"
          bg={color.surface}
          fg={color.onPrimaryContainer}
          onPress={() => router.push("/admin/fees" as never)}
        />
      </Hero>

      {/* today snapshot */}
      <View style={styles.statRow}>
        <StatTile value={stats?.totalStudents ?? 0} label="Students" tint={color.primary} />
        <StatTile
          value={`${attendance.present}/${attendance.total}`}
          label="Staff present"
          tint={color.success}
        />
        <StatTile
          value={formatMoneyShort(stats?.totalFeeOutstanding)}
          label="Outstanding"
          tint={color.error}
        />
      </View>

      {/* fee collection progress */}
      <SectionCard heading="FEE COLLECTION">
        <ProgressRow
          label="Collected against demand"
          percent={collectionRate}
          valueLabel={`${Math.round(collectionRate)}%`}
          tint={collectionRate >= 75 ? color.success : color.warning}
        />
        <ListRow
          leading={<TonalTile bg={color.successContainer}><Icon name="trending-up" size={19} tint={color.success} /></TonalTile>}
          title={formatMoney(stats?.totalFeeCollected)}
          subtitle="Total collected"
        />
        <ListRow
          leading={<TonalTile bg={color.errorContainer}><Icon name="error-outline" size={19} tint={color.error} /></TonalTile>}
          title={`${stats?.studentsWithOutstandingFees ?? 0} students with dues`}
          subtitle={`${formatMoney(stats?.totalFeeOutstanding)} outstanding`}
          chevron
          onPress={() => router.push("/admin/fees" as never)}
        />
      </SectionCard>

      <SectionCard
        heading={`BUS EMI — ${activeBuses.length} BUSES`}
        trailing={
          overdueBuses > 0
            ? <Badge label={`${overdueBuses} overdue`} bg={color.errorContainer} fg={color.error} />
            : <Badge label="On track" bg={color.successContainer} fg={color.success} />
        }
      >
        <View style={styles.busSummary}>
          <View style={{ flex: 1 }}>
            <DSText variant="label">Monthly EMI total</DSText>
            <DSText variant="title" tint={color.ink}>{formatMoney(monthlyBusEmi)}</DSText>
          </View>
          <View style={{ flex: 1 }}>
            <DSText variant="label">Pending instalments</DSText>
            <DSText variant="title" tint={color.warning}>
              {activeBuses.reduce((sum, bus) => sum + Number(bus.pendingEmis ?? 0), 0)}
            </DSText>
          </View>
        </View>
        <View style={styles.busActions}>
          <View style={{ flex: 1 }}>
            <PillButton
              label="View Bus EMIs"
              block
              icon="directions-bus"
              onPress={() => setBusPanelOpen(true)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <PillButton
              label="Mark as paid"
              block
              icon="check-circle"
              bg={color.success}
              onPress={() => setBusPanelOpen(true)}
            />
          </View>
        </View>
      </SectionCard>

      {/* approvals */}
      <SectionCard
        heading="PENDING APPROVALS"
        trailing={pendingLeave.length > 0 ? <Badge label={`${pendingLeave.length}`} /> : undefined}
      >
        {pendingLeave.length === 0 ? (
          <DSText variant="label">Nothing waiting on you. All caught up.</DSText>
        ) : (
          pendingLeave.slice(0, 3).map((request) => (
            <ListRow
              key={request.id}
              leading={<TonalTile bg={color.warningContainer}><Icon name="flight-takeoff" size={19} tint={color.warning} /></TonalTile>}
              title={request.teacherName ?? "Staff leave request"}
              subtitle={`${request.leaveType ?? "Leave"} · ${formatDate(request.fromDate)}`}
              chevron
              onPress={() => router.push("/admin/approvals" as never)}
            />
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
            <Icon name={action.icon} size={22} tint={color.primary} />
            <DSText variant="caption" tint={color.ink2} style={{ fontWeight: "500" }}>{action.label}</DSText>
          </PressableScale>
        ))}
      </View>

      {/* recent payments */}
      <SectionCard heading="RECENT PAYMENTS">
        {payments.length === 0 ? (
          <DSText variant="label">No payments recorded yet today.</DSText>
        ) : (
          payments.slice(0, 4).map((payment) => (
            <ListRow
              key={payment.id}
              leading={<TonalTile bg={color.successContainer}><Icon name="check" size={19} tint={color.success} /></TonalTile>}
              title={payment.studentName ?? "Payment"}
              subtitle={`${formatMoney(payment.amountPaid)} · ${payment.paymentMethod || "—"}`}
              trailing={<DSText variant="caption">{formatDate(payment.createdAt)}</DSText>}
            />
          ))
        )}
      </SectionCard>
      </ScrollView>

      <FullScreenPanel
        visible={busPanelOpen}
        title={selectedBus?.vehicleNumber ?? "Bus EMIs"}
        subtitle={selectedBus ? selectedBus.financeCompany : `${activeBuses.length} active vehicle loans`}
        onClose={() => {
          setBusPanelOpen(false);
          setSelectedBus(null);
          setSchedule([]);
        }}
      >
        <ScrollView contentContainerStyle={styles.busPanel} showsVerticalScrollIndicator={false}>
          {selectedBus ? (
            <>
              <View style={styles.busDetailHeader}>
                <TonalTile bg={color.primaryContainer} size={40}>
                  <Icon name="directions-bus" size={22} tint={color.primary} />
                </TonalTile>
                <View style={{ flex: 1 }}>
                  <DSText variant="title">{selectedBus.vehicleName ?? selectedBus.vehicleNumber}</DSText>
                  <DSText variant="label">
                    {selectedBus.paidEmis ?? 0} paid · {selectedBus.pendingEmis ?? 0} remaining
                  </DSText>
                </View>
                <Badge
                  label={selectedBus.status ?? "active"}
                  bg={selectedBus.status === "overdue" ? color.errorContainer : color.successContainer}
                  fg={selectedBus.status === "overdue" ? color.error : color.success}
                />
              </View>
              {scheduleLoading ? <LoadingState label="Loading EMI schedule…" /> : null}
              {!scheduleLoading && schedule.length === 0 ? (
                <DSText variant="label">No EMI schedule is available for this vehicle.</DSText>
              ) : null}
              {schedule.map((payment) => {
                const paid = payment.status === "paid";
                return (
                  <SectionCard
                    key={payment.id}
                    heading={`EMI ${payment.emiNumber ?? "—"} · ${payment.emiMonth ?? ""}`}
                    trailing={
                      <Badge
                        label={paid ? "Paid" : payment.status ?? "Pending"}
                        bg={paid ? color.successContainer : color.warningContainer}
                        fg={paid ? color.success : color.onWarningDeep}
                      />
                    }
                  >
                    <ListRow
                      leading={
                        <TonalTile bg={paid ? color.successContainer : color.warningSurface} size={36}>
                          <Icon name={paid ? "check" : "schedule"} size={18} tint={paid ? color.success : color.warning} />
                        </TonalTile>
                      }
                      title={formatMoney(payment.emiAmount)}
                      subtitle={`Due ${formatDate(payment.dueDate)}${payment.paymentDate ? ` · paid ${formatDate(payment.paymentDate)}` : ""}`}
                      trailing={
                        !paid ? (
                          <PillButton
                            label={payingId === payment.id ? "Saving…" : "Pay"}
                            bg={color.onWarningDeep}
                            onPress={() => { if (!payingId) void payEmi(payment); }}
                          />
                        ) : undefined
                      }
                    />
                  </SectionCard>
                );
              })}
              <PillButton
                label="Back to vehicles"
                icon="arrow-back"
                bg={color.surfaceVariant}
                fg={color.ink2}
                onPress={() => {
                  setSelectedBus(null);
                  setSchedule([]);
                }}
              />
            </>
          ) : (
            <>
              <View style={styles.busStatRow}>
                <StatTile value={formatMoney(monthlyBusEmi)} label="Monthly due" tint={color.primary} />
                <StatTile value={overdueBuses} label="Overdue" tint={color.error} />
                <StatTile value={activeBuses.length} label="Active loans" tint={color.success} />
              </View>
              {busFinance.loading && activeBuses.length === 0 ? <LoadingState label="Loading bus finance…" /> : null}
              {activeBuses.map((bus) => (
                <PressableScale
                  key={bus.id}
                  accessibilityLabel={`Open EMI schedule for ${bus.vehicleNumber}`}
                  onPress={() => { void openBus(bus); }}
                  style={styles.busCard}
                >
                  <TonalTile bg={color.primaryContainer} size={40}>
                    <Icon name="directions-bus" size={21} tint={color.primary} />
                  </TonalTile>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <DSText variant="bodyMedium" numberOfLines={1}>{bus.vehicleNumber ?? "School bus"}</DSText>
                    <DSText variant="label" numberOfLines={1}>
                      {formatMoney(bus.emiAmount)} · {bus.pendingEmis ?? 0} EMIs remaining
                    </DSText>
                  </View>
                  <Badge
                    label={bus.status ?? "active"}
                    bg={bus.status === "overdue" ? color.errorContainer : color.successContainer}
                    fg={bus.status === "overdue" ? color.error : color.success}
                  />
                  <Icon name="chevron-right" size={20} tint={color.faint} />
                </PressableScale>
              ))}
            </>
          )}
        </ScrollView>
      </FullScreenPanel>
    </>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 },
  statRow: { flexDirection: "row", gap: 10 },
  quickGrid: { flexDirection: "row", gap: 10 },
  quickTile: {
    flex: 1,
    backgroundColor: color.surfaceVariant,
    borderRadius: radius.md,
    paddingVertical: space.md + 4,
    paddingHorizontal: space.xs,
    alignItems: "center",
    gap: space.sm
  },
  busSummary: { flexDirection: "row", gap: space.md },
  busActions: { flexDirection: "row", gap: space.sm },
  busPanel: { padding: space.xl, gap: 12, paddingBottom: space.xxl },
  busStatRow: { flexDirection: "row", gap: space.sm },
  busCard: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.outline,
    borderRadius: radius.md,
    padding: space.md,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md
  },
  busDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.outline,
    borderRadius: radius.md,
    padding: space.md
  }
});
