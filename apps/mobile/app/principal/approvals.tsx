/**
 * Principal verification queue from Principal App.dc.html.
 * Local state models the approval workflow until the staff-task endpoint is
 * available; the screen is otherwise production-ready and fully interactive.
 */
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Avatar, Badge, DSText, EmptyState, FilterChips, Icon, PageTitle, PillButton,
  SectionCard, useToast
} from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { PrincipalShell } from "@/features/admin/shell";

type QueueStatus = "Pending" | "Approved" | "Needs work";
type QueueItem = {
  id: string;
  initials: string;
  teacher: string;
  title: string;
  submitted: string;
  proof: string;
  status: QueueStatus;
};

const INITIAL_QUEUE: QueueItem[] = [
  {
    id: "1",
    initials: "PS",
    teacher: "Priya Sharma · Mathematics",
    title: "Upload Unit 4 test marks — 8A & 8B",
    submitted: "Submitted today · 10:14 AM",
    proof: "marks_register_8A_8B.jpg",
    status: "Pending"
  },
  {
    id: "2",
    initials: "VG",
    teacher: "Vikram Gupta · Physics",
    title: "Submit laboratory inventory",
    submitted: "Submitted yesterday · 4:35 PM",
    proof: "physics_lab_inventory.pdf",
    status: "Pending"
  }
];

const FILTERS = ["Pending", "Approved", "Needs work"];

export default function PrincipalApprovalsRoute() {
  return (
    <PrincipalShell>
      <PrincipalVerification />
    </PrincipalShell>
  );
}

function PrincipalVerification() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [filter, setFilter] = useState("Pending");
  const [queue, setQueue] = useState(INITIAL_QUEUE);
  const visible = useMemo(
    () => queue.filter((item) => item.status === filter),
    [filter, queue]
  );

  const decide = (id: string, status: QueueStatus) => {
    const item = queue.find((entry) => entry.id === id);
    setQueue((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, status } : entry))
    );
    toast.show(
      status === "Approved"
        ? `${item?.teacher.split(" ·")[0] ?? "Teacher"} notified · approved ✓`
        : "Sent back with a request for changes"
    );
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xs }]}
      showsVerticalScrollIndicator={false}
    >
      <PageTitle>Verification</PageTitle>
      <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

      {visible.length === 0 ? (
        <SectionCard heading={filter.toUpperCase()}>
          <EmptyState
            icon="task-alt"
            label={filter === "Pending" ? "All caught up — nothing to verify" : `No ${filter.toLowerCase()} tasks.`}
          />
        </SectionCard>
      ) : (
        visible.map((item) => (
          <SectionCard
            key={item.id}
            heading={filter === "Pending" ? "AWAITING YOUR REVIEW" : item.status.toUpperCase()}
            trailing={
              <Badge
                label={item.status}
                bg={
                  item.status === "Approved"
                    ? color.successContainer
                    : item.status === "Needs work"
                      ? color.errorContainer
                      : color.warningContainer
                }
                fg={
                  item.status === "Approved"
                    ? color.success
                    : item.status === "Needs work"
                      ? color.error
                      : color.onWarningDeep
                }
              />
            }
          >
            <View style={styles.teacherRow}>
              <Avatar label={item.initials} size={40} />
              <View style={{ flex: 1 }}>
                <DSText variant="bodyMedium">{item.teacher}</DSText>
                <DSText variant="label">{item.submitted}</DSText>
              </View>
            </View>
            <DSText variant="title" style={{ fontSize: 15 }}>{item.title}</DSText>
            <View style={styles.proof}>
              <Icon name="attachment" size={18} tint={color.primary} />
              <DSText variant="label" tint={color.ink2} style={{ flex: 1 }} numberOfLines={1}>
                {item.proof}
              </DSText>
              <DSText variant="bodyMedium" tint={color.primary}>View</DSText>
            </View>
            {item.status === "Pending" ? (
              <View style={styles.actions}>
                <View style={{ flex: 1 }}>
                  <PillButton
                    label="Needs work"
                    block
                    icon="undo"
                    bg={color.errorContainer}
                    fg={color.error}
                    onPress={() => decide(item.id, "Needs work")}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <PillButton
                    label="Approve"
                    block
                    icon="check"
                    bg={color.successContainer}
                    fg={color.onSuccessContainer}
                    onPress={() => decide(item.id, "Approved")}
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

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 12 },
  teacherRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  proof: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: color.surfaceVariant,
    borderRadius: radius.sm,
    padding: 10
  },
  actions: { flexDirection: "row", gap: space.sm }
});
