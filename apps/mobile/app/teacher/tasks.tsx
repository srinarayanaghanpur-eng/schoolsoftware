/**
 * Teacher Tasks — list + proof/submission drill-in from Teacher App.dc.html.
 * Task data remains local until the staff-task API lands; every interaction is
 * complete so the endpoint can replace INITIAL_TASKS without changing the UI.
 */
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Badge, DSText, EmptyState, FilterChips, FullScreenPanel, Icon, ListRow,
  PageTitle, PillButton, PressableScale, SectionCard, TonalTile, useToast
} from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { TeacherShell } from "@/features/teacher/shell";

const FILTERS = ["All", "Pending", "Done"];

type TaskStatus = "pending" | "submitted" | "approved";
type ProofFile = { name: string; size: string };
type TeacherTask = {
  id: string;
  title: string;
  from: string;
  due: string;
  description: string;
  status: TaskStatus;
  proof: ProofFile[];
};

const BADGE = {
  pending: { label: "Pending", bg: color.warningContainer, fg: color.onWarningDeep },
  submitted: { label: "In review", bg: color.primaryContainer, fg: color.onPrimaryContainer },
  approved: { label: "Approved", bg: color.successContainer, fg: color.onSuccessContainer }
};

const INITIAL_TASKS: TeacherTask[] = [
  {
    id: "1",
    title: "Upload Unit 4 test marks — 8A & 8B",
    from: "Principal",
    due: "Today, 4:00 PM",
    description:
      "Enter and upload the Unit 4 mathematics test marks for classes 8A and 8B. Attach the signed marks register sheet as proof.",
    status: "pending",
    proof: []
  },
  {
    id: "2",
    title: "Submit lesson plan — Week 32",
    from: "Principal",
    due: "Today, 5:00 PM",
    description:
      "Upload the weekly lesson plan for classes 8A, 8B, 9A and 10B covering chapters as per the syllabus tracker.",
    status: "pending",
    proof: []
  },
  {
    id: "3",
    title: "PTM feedback summary",
    from: "Vice Principal",
    due: "Tomorrow",
    description: "Compile parent feedback from Saturday's PTM into the shared summary form.",
    status: "submitted",
    proof: [{ name: "ptm_feedback.pdf", size: "824 KB" }]
  },
  {
    id: "4",
    title: "Science fair duty roster",
    from: "Principal",
    due: "18 Jul",
    description: "Confirm your invigilation slots for the science fair.",
    status: "approved",
    proof: [{ name: "roster_signed.jpg", size: "1.2 MB" }]
  }
];

export default function TeacherTasksRoute() {
  return (
    <TeacherShell>
      <TeacherTasks />
    </TeacherShell>
  );
}

function TeacherTasks() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [filter, setFilter] = useState("All");
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visible = useMemo(() => {
    if (filter === "Pending") return tasks.filter((task) => task.status === "pending");
    if (filter === "Done") return tasks.filter((task) => task.status !== "pending");
    return tasks;
  }, [tasks, filter]);
  const selected = tasks.find((task) => task.id === selectedId) ?? null;
  const pending = tasks.filter((task) => task.status === "pending").length;

  const addProof = () => {
    if (!selected) return;
    setTasks((current) =>
      current.map((task) =>
        task.id === selected.id
          ? {
              ...task,
              proof: [
                ...task.proof,
                {
                  name: `IMG_${2040 + task.proof.length}.jpg`,
                  size: `${(1 + task.proof.length * 0.4).toFixed(1)} MB`
                }
              ]
            }
          : task
      )
    );
    toast.show("Proof attached ✓");
  };

  const submit = () => {
    if (!selected) return;
    if (selected.proof.length === 0) {
      toast.show("Attach at least one proof file first");
      return;
    }
    setTasks((current) =>
      current.map((task) =>
        task.id === selected.id ? { ...task, status: "submitted" as const } : task
      )
    );
    setSelectedId(null);
    toast.show("Task submitted to the principal ✓");
  };

  return (
    <>
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
            <EmptyState icon="task-alt" label="No tasks in this filter." />
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
                  onPress={() => setSelectedId(task.id)}
                />
              );
            })
          )}
        </SectionCard>
      </ScrollView>

      <FullScreenPanel
        visible={Boolean(selected)}
        title="Task"
        subtitle={selected ? `Assigned by ${selected.from}` : undefined}
        onClose={() => setSelectedId(null)}
        footer={
          selected?.status === "pending" ? (
            <PillButton
              label={selected.proof.length > 0 ? "Submit for review" : "Attach proof to submit"}
              block
              icon="send"
              bg={selected.proof.length > 0 ? color.primary : color.outlineStrong}
              fg={selected.proof.length > 0 ? color.onPrimary : color.muted}
              onPress={submit}
            />
          ) : undefined
        }
      >
        {selected ? (
          <ScrollView contentContainerStyle={styles.detail} showsVerticalScrollIndicator={false}>
            <View style={styles.statusRow}>
              <Badge
                label={BADGE[selected.status].label}
                bg={BADGE[selected.status].bg}
                fg={BADGE[selected.status].fg}
              />
              <DSText variant="label">Due {selected.due}</DSText>
            </View>
            <DSText variant="display" style={styles.detailTitle}>{selected.title}</DSText>
            <DSText variant="body">{selected.description}</DSText>

            <View style={styles.metaRow}>
              <View style={styles.metaTile}>
                <Icon name="event" size={17} tint={color.primary} />
                <DSText variant="label" tint={color.ink2}>{selected.due}</DSText>
              </View>
              <View style={styles.metaTile}>
                <Icon name="attach-file" size={17} tint={color.primary} />
                <DSText variant="label" tint={color.ink2}>Proof needed</DSText>
              </View>
            </View>

            {selected.status === "approved" ? (
              <View style={styles.approved}>
                <TonalTile bg={color.success} size={36}>
                  <Icon name="verified" size={20} tint={color.onPrimary} />
                </TonalTile>
                <View style={{ flex: 1 }}>
                  <DSText variant="bodyMedium" tint={color.onSuccessContainer}>
                    Approved by Principal
                  </DSText>
                  <DSText variant="label" tint={color.success}>Great work — task completed.</DSText>
                </View>
              </View>
            ) : null}

            <DSText variant="overline">PROOF OF WORK</DSText>
            {selected.proof.map((file) => (
              <View key={file.name} style={styles.fileRow}>
                <Icon name="image" size={20} tint={color.primary} />
                <DSText variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>
                  {file.name}
                </DSText>
                <DSText variant="label">{file.size}</DSText>
              </View>
            ))}
            {selected.status === "pending" ? (
              <PressableScale
                accessibilityLabel="Add photo or file"
                onPress={addProof}
                style={styles.addProof}
              >
                <Icon name="add-photo-alternate" size={20} tint={color.primary} />
                <DSText variant="bodyMedium" tint={color.primary}>Add photo or file</DSText>
              </PressableScale>
            ) : null}
            {selected.status === "submitted" ? (
              <View style={styles.review}>
                <Icon name="hourglass-top" size={20} tint={color.primary} />
                <DSText variant="bodyMedium" tint={color.onPrimaryContainer}>
                  Submitted · waiting for principal review
                </DSText>
              </View>
            ) : null}
          </ScrollView>
        ) : null}
      </FullScreenPanel>
    </>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 },
  detail: { padding: space.xl, paddingBottom: space.xxl, gap: 14 },
  detailTitle: { fontSize: 22, lineHeight: 28 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  metaRow: { flexDirection: "row", gap: space.sm },
  metaTile: {
    flex: 1,
    backgroundColor: color.surfaceVariant,
    borderRadius: radius.md,
    padding: space.md,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm
  },
  approved: {
    backgroundColor: color.successContainer,
    borderRadius: radius.md,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md
  },
  fileRow: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.outline,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  addProof: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: color.faint,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm
  },
  review: {
    backgroundColor: color.primaryContainer,
    borderRadius: radius.md,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  }
});
