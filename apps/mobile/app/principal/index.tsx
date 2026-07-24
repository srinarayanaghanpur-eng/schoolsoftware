/**
 * Principal Home — exact staff-first layout from Principal App.dc.html:
 * snapshot, assign-task hero, verification queue, late/leave rows and broadcast.
 */
import React, { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Avatar, Badge, BottomSheet, DSText, EmptyState, ErrorState, Hero, Icon,
  ListRow, LoadingState, PillButton, PressableScale, ScreenHeader, SectionCard,
  StatTile, useToast
} from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { useMobileSession } from "@/lib/mobileSession";
import { PrincipalShell } from "@/features/admin/shell";
import { useDashboardStats, useTodayAttendance } from "@/features/admin/hooks";
import { greeting, initials } from "@/features/teacher/hooks";

type QueueItem = {
  id: string;
  initials: string;
  title: string;
  teacher: string;
  when: string;
  proof: string;
};

const INITIAL_QUEUE: QueueItem[] = [
  {
    id: "1",
    initials: "PS",
    title: "Upload Unit 4 test marks — 8A & 8B",
    teacher: "Priya Sharma · Mathematics",
    when: "today, 10:14 AM",
    proof: "marks_register_8A_8B.jpg"
  },
  {
    id: "2",
    initials: "VG",
    title: "Submit laboratory inventory",
    teacher: "Vikram Gupta · Physics",
    when: "yesterday, 4:35 PM",
    proof: "physics_lab_inventory.pdf"
  }
];

export default function PrincipalHomeRoute() {
  return (
    <PrincipalShell>
      <PrincipalHome />
    </PrincipalShell>
  );
}

function PrincipalHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { profile } = useMobileSession();
  const attendance = useTodayAttendance();
  const { stats, loading, error, refresh } = useDashboardStats();
  const [queue, setQueue] = useState(INITIAL_QUEUE);
  const [sheet, setSheet] = useState<"assign" | "broadcast" | null>(null);
  const [draft, setDraft] = useState("");

  if (attendance.loading && attendance.total === 0 && !stats) {
    return <LoadingState label="Loading today's snapshot…" />;
  }
  if (error && !stats) return <ErrorState message={error} onRetry={refresh} />;

  const name = profile?.displayName ?? "Mrs. Kapoor";
  const resolveQueue = (item: QueueItem, approved: boolean) => {
    setQueue((current) => current.filter((entry) => entry.id !== item.id));
    toast.show(
      approved
        ? `${item.teacher.split(" ·")[0]} notified · approved ✓`
        : "Task sent back with a note"
    );
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xs }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={attendance.loading || loading}
            onRefresh={() => { attendance.refresh(); refresh(); }}
            tintColor={color.primary}
          />
        }
      >
        <ScreenHeader
          eyebrow={`${greeting()} · Principal`}
          title={name}
          trailing={
            <PressableScale
              accessibilityLabel="Profile"
              onPress={() => router.push("/principal/profile" as never)}
            >
              <Avatar label={initials(name)} size={42} bg={color.accountPurple} />
            </PressableScale>
          }
        />

        <View style={styles.statRow}>
          <StatTile
            value={`${attendance.present}/${attendance.total}`}
            label="Staff present"
            tint={color.success}
          />
          <StatTile value={stats?.totalStudents ?? 0} label="Students in" tint={color.primary} />
          <StatTile value={queue.length} label="To verify" tint={color.ink} />
        </View>

        <Hero>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.promptTitle}>Assign a task</Text>
            <Text style={styles.promptMeta}>Delegate work to any teacher in seconds</Text>
          </View>
          <PillButton
            label="New task"
            icon="add-task"
            bg={color.surface}
            fg={color.onPrimaryContainer}
            onPress={() => setSheet("assign")}
          />
        </Hero>

        <SectionCard
          heading="VERIFICATION QUEUE"
          trailing={queue.length > 0 ? <Badge label={`${queue.length} pending`} /> : undefined}
        >
          {queue.length === 0 ? (
            <EmptyState icon="task-alt" label="All caught up — queue is clear" />
          ) : (
            queue.map((item) => (
              <View key={item.id} style={styles.queueCard}>
                <View style={styles.teacherRow}>
                  <Avatar label={item.initials} size={36} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <DSText variant="bodyMedium" numberOfLines={1}>{item.title}</DSText>
                    <DSText variant="label" numberOfLines={1}>
                      {item.teacher} · submitted {item.when}
                    </DSText>
                  </View>
                </View>
                <View style={styles.proofRow}>
                  <Icon name="attachment" size={18} tint={color.primary} />
                  <DSText variant="label" tint={color.ink2} style={{ flex: 1 }} numberOfLines={1}>
                    {item.proof}
                  </DSText>
                  <DSText variant="bodyMedium" tint={color.primary}>View</DSText>
                </View>
                <View style={styles.actions}>
                  <View style={{ flex: 1 }}>
                    <PillButton
                      label="Approve"
                      block
                      bg={color.success}
                      onPress={() => resolveQueue(item, true)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PillButton
                      label="Send back"
                      block
                      bg={color.surface}
                      fg={color.error}
                      onPress={() => resolveQueue(item, false)}
                    />
                  </View>
                </View>
              </View>
            ))
          )}
        </SectionCard>

        <SectionCard heading="STAFF ATTENDANCE — LATE TODAY">
          <ListRow
            leading={<Avatar label="VG" size={36} bg={color.surfaceVariant} fg={color.ink2} />}
            title="Vikram Gupta · Physics"
            subtitle="Checked in 8:24 AM · 24 min late"
            trailing={<Badge label="Late" bg={color.errorContainer} fg={color.error} />}
            onPress={() => router.push("/principal/staff" as never)}
          />
          <ListRow
            leading={<Avatar label="SN" size={36} bg={color.surfaceVariant} fg={color.ink2} />}
            title="Sunita Nair · English"
            subtitle="On leave · approved"
            trailing={<Badge label="Leave" bg={color.warningContainer} fg={color.onWarningDeep} />}
            onPress={() => router.push("/principal/staff" as never)}
          />
        </SectionCard>

        <SectionCard heading="BROADCAST">
          <PressableScale
            accessibilityLabel="Send announcement to all staff"
            onPress={() => setSheet("broadcast")}
            style={styles.broadcast}
          >
            <Icon name="campaign" size={19} tint={color.primary} />
            <DSText variant="bodyMedium" tint={color.primary}>
              Send announcement to all staff
            </DSText>
          </PressableScale>
        </SectionCard>
      </ScrollView>

      <BottomSheet
        visible={Boolean(sheet)}
        title={sheet === "assign" ? "Assign a task" : "Staff announcement"}
        onClose={() => setSheet(null)}
        primaryLabel={sheet === "assign" ? "Assign task" : "Send announcement"}
        onPrimary={() => {
          toast.show(
            sheet === "assign"
              ? "Task assigned to Priya Sharma ✓"
              : "Announcement sent to all staff ✓"
          );
          setDraft("");
          setSheet(null);
        }}
      >
        <DSText variant="overline">{sheet === "assign" ? "ASSIGN TO" : "SEND TO"}</DSText>
        {sheet === "assign" ? (
          <View style={styles.assignee}>
            <Avatar label="PS" size={38} />
            <View>
              <DSText variant="bodyMedium">Priya Sharma</DSText>
              <DSText variant="label">Mathematics · Class teacher 9A</DSText>
            </View>
          </View>
        ) : (
          <View style={styles.audienceRow}>
            <Badge label="All staff" bg={color.primaryContainer} fg={color.onPrimaryContainer} />
            <Badge label="Teachers only" bg={color.surfaceVariant} fg={color.ink2} />
            <Badge label="Admin staff" bg={color.surfaceVariant} fg={color.ink2} />
          </View>
        )}
        <TextInput
          style={styles.input}
          multiline
          placeholder={sheet === "assign" ? "Task title and instructions" : "Write announcement"}
          placeholderTextColor={color.muted}
          value={draft}
          onChangeText={setDraft}
        />
        {sheet === "assign" ? (
          <View style={styles.dueRow}>
            <View style={styles.metaTile}>
              <Icon name="event" size={17} tint={color.primary} />
              <DSText variant="label" tint={color.ink2}>Due today, 4 PM</DSText>
            </View>
            <View style={styles.metaTile}>
              <Icon name="attach-file" size={17} tint={color.primary} />
              <DSText variant="label" tint={color.ink2}>Proof needed</DSText>
            </View>
          </View>
        ) : null}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 },
  statRow: { flexDirection: "row", gap: 10 },
  promptTitle: { fontSize: 15, fontWeight: "600", color: color.onPrimary },
  promptMeta: { fontSize: 12.5, color: color.onPrimary, opacity: 0.8, marginTop: 2 },
  queueCard: {
    borderWidth: 1,
    borderColor: color.outline,
    borderRadius: radius.md,
    padding: space.md,
    gap: 10
  },
  teacherRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  proofRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: color.surfaceVariant,
    borderRadius: radius.sm,
    padding: 10
  },
  actions: { flexDirection: "row", gap: space.sm },
  broadcast: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: color.faint,
    borderRadius: 14,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm
  },
  assignee: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: color.surfaceVariant,
    borderRadius: radius.md,
    padding: space.md
  },
  audienceRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  input: {
    minHeight: 112,
    backgroundColor: color.surfaceVariant,
    borderRadius: radius.md,
    padding: 14,
    fontSize: 14,
    color: color.ink,
    textAlignVertical: "top"
  },
  dueRow: { flexDirection: "row", gap: space.sm },
  metaTile: {
    flex: 1,
    backgroundColor: color.surfaceVariant,
    borderRadius: radius.md,
    padding: space.md,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm
  }
});
