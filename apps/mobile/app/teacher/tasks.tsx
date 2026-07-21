/**
 * Teacher Tasks.
 *
 * NOTE: there is no /api/tasks endpoint yet (Phase 2 backlog), so this screen
 * ships the design's structure with a truthful empty state rather than the
 * mockup's invented task list. When the endpoint lands, replace `tasks` with
 * the fetch — the layout below already handles data.
 */
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Badge, DSText, EmptyState, FilterChips, Icon, ListRow, PageTitle, SectionCard, TonalTile
} from "@/design-system/components";
import { color, space } from "@/design-system/tokens";
import { TeacherShell } from "@/features/teacher/shell";

const FILTERS = ["All", "Pending", "Done"];

type TeacherTask = {
  id: string;
  title: string;
  from: string;
  due: string;
  status: "pending" | "submitted" | "approved";
};

const BADGE = {
  pending: { label: "Pending", bg: color.warningContainer, fg: color.onWarningDeep },
  submitted: { label: "In review", bg: color.primaryContainer, fg: color.onPrimaryContainer },
  approved: { label: "Approved", bg: color.successContainer, fg: color.onSuccessContainer }
};

export default function TeacherTasksRoute() {
  return (
    <TeacherShell>
      <TeacherTasks />
    </TeacherShell>
  );
}

function TeacherTasks() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState("All");

  /** Replace with a fetch once /api/tasks exists. */
  const tasks: TeacherTask[] = [];

  const visible = useMemo(() => {
    if (filter === "Pending") return tasks.filter((t) => t.status === "pending");
    if (filter === "Done") return tasks.filter((t) => t.status === "approved");
    return tasks;
  }, [tasks, filter]);

  const pending = tasks.filter((t) => t.status === "pending").length;

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xs }]}
      showsVerticalScrollIndicator={false}
    >
      <PageTitle>Tasks</PageTitle>

      <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

      <SectionCard
        heading="ASSIGNED TO ME"
        trailing={pending > 0 ? <Badge label={`${pending} due`} /> : undefined}
      >
        {visible.length === 0 ? (
          <EmptyState
            icon="task-alt"
            label="No tasks assigned to you. Tasks from the principal will appear here."
          />
        ) : (
          visible.map((task) => {
            const badge = BADGE[task.status];
            return (
              <ListRow
                key={task.id}
                leading={
                  <TonalTile bg={badge.bg}>
                    <Icon name="assignment" size={19} tint={badge.fg} />
                  </TonalTile>
                }
                title={task.title}
                subtitle={`${task.from} · due ${task.due}`}
                trailing={<Badge label={badge.label} bg={badge.bg} fg={badge.fg} />}
                chevron
              />
            );
          })
        )}
      </SectionCard>

      <DSText variant="caption" style={{ textAlign: "center" }}>
        Task assignment is rolling out with the next school release.
      </DSText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 }
});
