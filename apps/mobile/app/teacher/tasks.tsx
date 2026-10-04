/**
 * Teacher Tasks — mirrors the Tasks tab of Teacher App.dc.html.
 *
 * There is no tasks endpoint yet, so this screen honestly says so instead of
 * showing invented assignments. Wire the render loop to the fetch when the
 * endpoint lands.
 */
import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DSText, EmptyState, PageTitle, SectionCard } from "@/design-system/components";
import { color, space } from "@/design-system/tokens";
import { TeacherShell } from "@/features/teacher/shell";

export default function TeacherTasksRoute() {
  return (
    <TeacherShell>
      <TeacherTasks />
    </TeacherShell>
  );
}

function TeacherTasks() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xs }]}
      showsVerticalScrollIndicator={false}
    >
      <PageTitle>Tasks</PageTitle>

      <SectionCard heading="ASSIGNED TO ME">
        <EmptyState
          icon="task-alt"
          label="No tasks assigned to you. Tasks from the principal will appear here."
        />
      </SectionCard>

      <DSText variant="caption" style={{ textAlign: "center" }}>
        Task assignment arrives with the next school release.
      </DSText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 }
});
