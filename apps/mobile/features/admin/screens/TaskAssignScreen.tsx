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

type TaskTeacher = { id: string; name: string; employeeId?: string; subject?: string };

export function TaskAssignScreen() {
  const { t } = useTheme();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [posting, setPosting] = useState(false);
  const [busyCancelId, setBusyCancelId] = useState<string | null>(null);
  const { teachers, other, refresh: refreshStaff } = useStaffDirectory();
  const { tasks, loading, error, refresh } = useTasks();

  useFocusEffect(
    React.useCallback(() => {
      void refresh();
      void refreshStaff();
    }, [refresh, refreshStaff])
  );

  const teacherOptions = useMemo<TaskTeacher[]>(() => {
    const options: TaskTeacher[] = [];
    const seen = new Set<string>();
    for (const member of teachers) {
      if (seen.has(member.id)) continue;
      seen.add(member.id);
      options.push({
        id: member.id,
        name: staffField(member, "fullName") || staffField(member, "name") || staffField(member, "displayName") || member.employeeId || "Unnamed",
        employeeId: member.employeeId,
        subject: member.subject
      });
    }
    // Teacher logins can exist before their teachers/ master record. They are
    // still valid assignees, so include teacher-role entries from "other".
    for (const member of other) {
      if ((member.role ?? "").trim().toLowerCase() !== "teacher" || seen.has(member.id)) continue;
      seen.add(member.id);
      options.push({
        id: member.id,
        name: staffField(member, "displayName") || staffField(member, "fullName") || staffField(member, "name") || member.email || member.employeeId || "Teacher",
        employeeId: member.employeeId
      });
    }
    return options;
  }, [teachers, other]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return teacherOptions
      .filter((member) =>
        `${member.name} ${member.employeeId ?? ""} ${member.subject ?? ""}`
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 8);
  }, [teacherOptions, query]);

  const assigned = useMemo(() => tasks.filter((task) => task.status === "assigned"), [tasks]);

  const submit = async () => {
    if (!teacherId || !title.trim()) {
      toast.show("Pick a teacher and enter a title.");
      return;
    }
    if (dueDate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())) {
      toast.show("Due date must be YYYY-MM-DD (or leave it empty).");
      return;
    }
    setPosting(true);
    try {
      await assignTask({
        teacherId,
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate.trim() || undefined
      });
      toast.show(`Task assigned to ${teacherName || "teacher"} ✓`);
      setTitle("");
      setDescription("");
      setDueDate("");
      await refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Unable to assign task.");
    } finally {
      setPosting(false);
    }
  };

  const cancel = async (taskId: string) => {
    setBusyCancelId(taskId);
    try {
      await updateTaskStatus(taskId, "cancelled");
      toast.show("Task cancelled.");
      await refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't cancel the task.");
    } finally {
      setBusyCancelId(null);
    }
  };

  return (
    <FlatList
      data={assigned}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ListRow
          leading={
            <TonalTile bg={t.warnBg}>
              <Icon name="assignment" size={19} tint={t.warn} />
            </TonalTile>
          }
          title={formatText(item.title, "Task")}
          subtitle={`${formatText(item.teacherName, "Teacher")}${item.dueDate ? ` · Due ${item.dueDate}` : ""}`}
          trailing={
            <PillButton
              label={busyCancelId === item.id ? "Saving…" : "Cancel"}
              icon="close"
              bg={t.badBg}
              fg={t.bad}
              onPress={() => { if (!busyCancelId) void cancel(item.id); }}
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
          <PageTitle>Assign task</PageTitle>
          <SectionCard heading="NEW TASK">
            <TextField
              value={query}
              onChangeText={(text) => { setQuery(text); }}
              placeholder="Search teacher by name, ID or subject"
              accessibilityLabel="Search teacher"
            />
            {matches.length > 0 ? (
              <View style={{ gap: 2 }}>
                {matches.map((member) => (
                  <ListRow
                    key={member.id}
                    leading={<Avatar label={initials(member.name || "?")} size={36} />}
                    title={member.name || "Unnamed"}
                    subtitle={`${member.subject ?? "—"}${member.employeeId ? ` · ${member.employeeId}` : ""}`}
                    chevron={teacherId !== member.id}
                    trailing={
                      teacherId === member.id ? (
                        <DSText variant="caption" tint={t.ok}>Selected ✓</DSText>
                      ) : undefined
                    }
                    onPress={() => {
                      setTeacherId(member.id);
                      setTeacherName(member.name);
                      setQuery(member.name);
                    }}
                  />
                ))}
              </View>
            ) : null}
            {teacherId ? (
              <DSText variant="label" tint={t.ok}>To: {teacherName || teacherId}</DSText>
            ) : null}
            <TextField
              value={title}
              onChangeText={setTitle}
              placeholder="Title — e.g. Decorate the notice board"
              accessibilityLabel="Task title"
            />
            <TextField
              value={description}
              onChangeText={setDescription}
              placeholder="Details (optional)"
              multiline
              accessibilityLabel="Task details"
            />
            <TextField
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="Due date YYYY-MM-DD (optional)"
              accessibilityLabel="Due date"
            />
            <PillButton
              label={posting ? "Assigning…" : "Assign task"}
              block
              bg={t.blue}
              fg="#FFFFFF"
              icon="send"
              onPress={() => { if (!posting) void submit(); }}
            />
          </SectionCard>
          <DSText variant="overline">OPEN TASKS · {assigned.length}</DSText>
        </View>
      }
      ListEmptyComponent={
        loading ? null : error ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : (
          <EmptyState icon="task-alt" label="No open tasks. Assigned tasks appear here." />
        )
      }
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={7}
      removeClippedSubviews={true}
    />
  );
}

/* ---------------------------------------------------------------- Profile */
