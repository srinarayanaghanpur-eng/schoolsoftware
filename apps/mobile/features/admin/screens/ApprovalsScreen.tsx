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

const APPROVAL_FILTERS = ["Pending", "Approved", "Rejected"];

export function ApprovalsScreen() {
  const { t } = useTheme();
  const toast = useToast();
  const [tab, setTab] = useState("Leave");
  const [filter, setFilter] = useState("Pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyChangeId, setBusyChangeId] = useState<string | null>(null);
  const { requests, loading, error, refresh } = useLeaveRequests();
  const {
    changes, loading: changesLoading, error: changesError, refresh: refreshChanges
  } = useChangeRequests(filter.toLowerCase());

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

  async function decideChange(changeId: string, status: "approved" | "rejected") {
    setBusyChangeId(changeId);
    try {
      await decideChangeRequest(changeId, status);
      toast.show(status === "approved" ? "Change applied ✓" : "Change rejected");
      refreshChanges();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn’t update the request.");
    } finally {
      setBusyChangeId(null);
    }
  }

  const showLeave = tab === "Leave";

  if (showLeave) {
    if (loading && requests.length === 0) return <SkeletonPage />;
    if (error && requests.length === 0) return <ErrorState message={error} onRetry={refresh} />;
  } else {
    if (changesLoading && changes.length === 0) return <SkeletonPage />;
    if (changesError && changes.length === 0) {
      return <ErrorState message={changesError} onRetry={refreshChanges} />;
    }
  }

  const changeLabel = (entity: string) => entity.replace(/_/g, " ").toUpperCase();
  const patchLines = (patch?: Record<string, unknown>) =>
    Object.entries(patch ?? {}).slice(0, 5).map(([key, value]) => (
      `${key}: ${Array.isArray(value) ? `${value.length} items` : formatText(value)}`
    ));
  const emptyLabel = !showLeave
    ? `No ${filter.toLowerCase()} change requests.`
    : filter === "Pending"
      ? "Nothing waiting on you. All caught up."
      : `No ${filter.toLowerCase()} requests.`;

  return (
    <FlatList
      data={showLeave ? visible : changes}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        if (showLeave) {
          const request = item as (typeof visible)[number];
          return (
            <SectionCard
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
          );
        }
        const change = item as (typeof changes)[number];
        const lines = patchLines(change.patch);
        return (
          <SectionCard
            heading={`${change.action.toUpperCase()} · ${changeLabel(change.entity)}`}
            trailing={<DSText variant="caption">{formatDate(change.createdAt)}</DSText>}
          >
            <ListRow
              leading={<Avatar label={initials(change.requestedByName ?? "?")} size={40} />}
              title={change.requestedByName ?? "Staff member"}
              subtitle={change.note ? change.note : `Item ${change.entityId?.slice(0, 8) ?? "…"}…`}
            />
            {change.action === "edit" && lines.length > 0 ? (
              <View style={{ marginTop: space.xs, gap: 2 }}>
                {lines.map((line) => (
                  <DSText key={line} variant="label" tint={t.mute} numberOfLines={1}>{line}</DSText>
                ))}
              </View>
            ) : null}
            {filter === "Pending" ? (
              <View style={styles.decisionRow}>
                <View style={{ flex: 1 }}>
                  <PillButton
                    label={busyChangeId === change.id ? "Saving…" : "Approve"}
                    block
                    icon="check"
                    bg={t.blue}
                    fg="#FFFFFF"
                    onPress={() => { if (!busyChangeId) { if (change.action === "delete" && !confirm(`Delete ${change.entity ?? "entity"} (id: ${change.entityId ?? "unknown"})`)) return; void decideChange(change.id, "approved"); } }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <PillButton
                    label="Reject"
                    block
                    icon="close"
                    bg={t.badBg}
                    fg={t.bad}
                    onPress={() => { if (!busyChangeId) void decideChange(change.id, "rejected"); }}
                  />
                </View>
              </View>
            ) : null}
          </SectionCard>
        );
      }}
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={showLeave ? loading : changesLoading}
          onRefresh={() => { refresh(); refreshChanges(); }}
          tintColor={t.blue}
        />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <PageTitle>Approvals</PageTitle>
          <FilterChips options={["Leave", "Changes"]} value={tab} onChange={setTab} />
          <FilterChips options={APPROVAL_FILTERS} value={filter} onChange={setFilter} />
        </View>
      }
      ListEmptyComponent={
        <SectionCard heading={filter.toUpperCase()}>
          <EmptyState icon="fact-check" label={emptyLabel} />
        </SectionCard>
      }
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={7}
      removeClippedSubviews={true}
    />
  );
}
