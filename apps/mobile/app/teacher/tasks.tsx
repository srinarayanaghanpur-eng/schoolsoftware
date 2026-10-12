/**
 * Teacher Tasks — tasks assigned by the principal/admin.
 * Tap "Mark done" to complete; the list refreshes from the server.
 */
import React from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import {
  DSText, EmptyState, ErrorState, Icon, ListRow, SkeletonPage,
  PageTitle, PillButton, TonalTile, useToast
} from "@/design-system/components";
import { space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import { useMobileSession } from "@/lib/mobileSession";
import { useTeacherAttendanceData } from "@/lib/useTeacherAttendanceData";
import { TeacherShell } from "@/features/teacher/shell";
import { updateTaskStatus } from "@/features/admin/api";
import { useTasks } from "@/features/admin/hooks";
import { asText } from "@/lib/text";

export default function TeacherTasksRoute() {
  return (
    <TeacherShell>
      <TeacherTasks />
    </TeacherShell>
  );
}

function TeacherTasks() {
  const { t } = useTheme();
  const toast = useToast();
  const { profile } = useMobileSession();
  const { teacher } = useTeacherAttendanceData();
  const teacherId = teacher?.id ?? profile?.teacherId ?? "";
  const { tasks, loading, error, refresh } = useTasks(teacherId);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const open = tasks.filter((task) => task.status === "assigned");
  const done = tasks.filter((task) => task.status !== "assigned");

  const markDone = async (taskId: string) => {
    setBusyId(taskId);
    try {
      await updateTaskStatus(taskId, "done");
      toast.show("Task completed ✓");
      refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't update the task.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading && tasks.length === 0) return <SkeletonPage />;
  if (error && tasks.length === 0) return <ErrorState message={error} onRetry={refresh} />;

  const renderTask = ({ item }: { item: (typeof tasks)[number] }) => {
    const isDone = item.status !== "assigned";
    return (
      <ListRow
        leading={
          <TonalTile bg={isDone ? t.okBg : t.warnBg}>
            <Icon name={isDone ? "check-circle" : "assignment"} size={19} tint={isDone ? t.ok : t.warn} />
          </TonalTile>
        }
        title={asText(item.title) || "Task"}
        subtitle={`${asText(item.description).slice(0, 80) || "No details"}${item.dueDate ? ` · Due ${asText(item.dueDate)}` : ""}`}
        trailing={
          !isDone ? (
            <PillButton
              label={busyId === item.id ? "Saving…" : "Mark done"}
              icon="check"
              bg={t.blue}
              fg="#FFFFFF"
              onPress={() => { if (!busyId) void markDone(item.id); }}
            />
          ) : (
            <DSText variant="caption" tint={t.ok}>Done</DSText>
          )
        }
      />
    );
  };

  return (
    <FlatList
      data={tasks}
      keyExtractor={(item) => item.id}
      renderItem={renderTask}
      ItemSeparatorComponent={() => <View style={[styles.divider, { backgroundColor: t.line }]} />}
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={t.blue} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <PageTitle>Tasks</PageTitle>
          <DSText variant="label" tint={t.mute}>
            {open.length === 0
              ? "No tasks assigned to you. Tasks from the principal will appear here."
              : `${open.length} task${open.length === 1 ? "" : "s"} to do${done.length > 0 ? ` · ${done.length} done` : ""}`}
          </DSText>
        </View>
      }
      ListEmptyComponent={
        <EmptyState icon="task-alt" label="No tasks assigned to you. Tasks from the principal will appear here." />
      }
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={7}
      removeClippedSubviews={true}
    />
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, paddingTop: space.md, gap: 14 },
  header: { gap: 10 },
  divider: { height: StyleSheet.hairlineWidth }
});
