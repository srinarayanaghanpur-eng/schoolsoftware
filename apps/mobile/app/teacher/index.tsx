/**
 * Teacher Home — implements the Home tab of the approved Teacher App design
 * (Teacher App.dc.html): greeting, check-in hero, today's classes, tasks,
 * quick actions, month stats and notices.
 *
 * DATA HONESTY: attendance figures and the school calendar are live. Timetable
 * and principal-assigned tasks have no mobile endpoint yet (Phase 2 backlog),
 * so those sections render representative PLACEHOLDER content to preserve the
 * designed layout. Each placeholder is marked below — swap it for the real
 * fetch when the endpoint lands; the section structure already handles data.
 */
import React from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Avatar, Badge, DSText, ErrorState, Hero, Icon, ListRow, LoadingState,
  PillButton, PressableScale, ScreenHeader, SectionCard, StatTile, TonalTile, useToast
} from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { useMobileSession } from "@/lib/mobileSession";
import { useTeacherAttendanceData } from "@/lib/useTeacherAttendanceData";
import { TeacherShell } from "@/features/teacher/shell";
import {
  dateLabel, formatTime, greeting, initials, statusTone, useAttendanceSummary
} from "@/features/teacher/hooks";

const QUICK_ACTIONS = [
  { key: "attendance", icon: "how-to-reg" as const, label: "Attendance", href: "/teacher/attendance" },
  { key: "academics", icon: "menu-book" as const, label: "Academics", href: "/teacher/academics" },
  { key: "tasks", icon: "task-alt" as const, label: "Tasks", href: "/teacher/tasks" },
  { key: "inbox", icon: "mail-outline" as const, label: "Inbox", href: "/teacher/inbox" }
];

/**
 * PLACEHOLDER — sample timetable, shown until /api/teacher/timetable exists.
 * Replace `TODAY_CLASSES` with the fetched schedule; the render loop below is
 * already data-driven.
 */
const TODAY_CLASSES = [
  { id: "now", subject: "Mathematics · 9A", meta: "Now · Rm 301", live: true },
  { id: "free", subject: "Free period", meta: "11:15 – 12:00", live: false },
  { id: "next", subject: "Mathematics · 10B", meta: "12:10 – 12:55 · Rm 108", live: false }
];

/** PLACEHOLDER — top principal-assigned task, until /api/tasks exists. */
const TOP_TASK = { title: "Upload Unit 4 test marks", from: "Principal", due: "Today, 4:00 PM", pending: 3 };

export default function TeacherHomeRoute() {
  return (
    <TeacherShell>
      <TeacherHome />
    </TeacherShell>
  );
}

function TeacherHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { profile } = useMobileSession();
  const { teacher, records, holidays, loading, error } = useTeacherAttendanceData();
  const summary = useAttendanceSummary(records);

  if (loading && !teacher) return <LoadingState label="Opening your workspace…" />;
  if (error && !teacher) return <ErrorState message={error} />;

  const name = teacher?.fullName ?? profile?.displayName ?? "Teacher";
  const today = statusTone(summary.today?.status);
  const nextHoliday = holidays
    .filter((h) => h.date >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xs }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => undefined} tintColor={color.primary} />}
    >
      <ScreenHeader
        eyebrow={`${greeting()} · ${dateLabel()}`}
        title={name}
        trailing={
          <View style={styles.headerActions}>
            <PressableScale
              accessibilityLabel="Notifications"
              onPress={() => router.push("/teacher/inbox" as never)}
              style={styles.bell}
            >
              <Icon name="notifications" size={21} tint={color.ink2} />
              <View style={styles.bellDot} />
            </PressableScale>
            <PressableScale accessibilityLabel="Profile" onPress={() => router.push("/teacher/profile" as never)}>
              <Avatar label={initials(name)} size={42} />
            </PressableScale>
          </View>
        }
      />

      {/* check-in hero */}
      {summary.checkedIn ? (
        <Hero tone="success">
          <TonalTile bg={color.success} size={40}>
            <Icon name="check" size={22} tint={color.onPrimary} />
          </TonalTile>
          <View style={{ flex: 1, minWidth: 0 }}>
            <DSText variant="bodyMedium" tint={color.onSuccessContainer}>
              Checked in · {formatTime(summary.today?.checkInTime)}
            </DSText>
            <DSText variant="label" tint={color.success}>{today.label} today</DSText>
          </View>
          <PillButton
            label="Check out"
            bg={color.successContainer}
            fg={color.success}
            onPress={() => router.push("/teacher/attendance" as never)}
          />
        </Hero>
      ) : (
        <Hero>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.heroTitle}>
              {summary.checkedOut ? "Day complete" : "You haven’t checked in"}
            </Text>
            <Text style={styles.heroMeta}>
              {summary.checkedOut
                ? `Checked out at ${formatTime(summary.today?.checkOutTime)}`
                : `Location is verified before attendance is saved · ${dateLabel()}`}
            </Text>
          </View>
          <PillButton
            label={summary.checkedOut ? "View" : "Check in"}
            bg={color.surface}
            fg={color.onPrimaryContainer}
            onPress={() => router.push("/teacher/attendance" as never)}
          />
        </Hero>
      )}

      {/* today's classes (placeholder timetable) */}
      <SectionCard
        heading="TODAY’S CLASSES"
        trailing={
          <PressableScale accessibilityLabel="Open timetable" onPress={() => router.push("/teacher/academics" as never)}>
            <DSText variant="bodyMedium" tint={color.primary}>Timetable</DSText>
          </PressableScale>
        }
      >
        {TODAY_CLASSES.map((cls) => (
          <View key={cls.id} style={[styles.classRow, cls.live && styles.classRowLive]}>
            <View style={[styles.dot, { backgroundColor: cls.live ? color.primary : color.faint }]} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <DSText variant="bodyMedium" tint={cls.live ? color.onPrimaryContainer : color.ink} numberOfLines={1}>
                {cls.subject}
              </DSText>
              <DSText variant="label" tint={cls.live ? color.primaryDeep : color.muted} numberOfLines={1}>
                {cls.meta}
              </DSText>
            </View>
            {cls.live ? (
              <PillButton
                label="Mark"
                icon="how-to-reg"
                onPress={() => router.push("/teacher/attendance" as never)}
              />
            ) : null}
          </View>
        ))}
      </SectionCard>

      {/* tasks summary (placeholder) */}
      <SectionCard heading="TASKS" trailing={<Badge label={`${TOP_TASK.pending} due`} />}>
        <ListRow
          leading={<TonalTile bg={color.warningSurface}><Icon name="upload-file" size={19} tint={color.warning} /></TonalTile>}
          title={TOP_TASK.title}
          subtitle={`From ${TOP_TASK.from} · due ${TOP_TASK.due}`}
          chevron
          onPress={() => router.push("/teacher/tasks" as never)}
        />
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

      {/* month stats (live) */}
      <View style={styles.statRow}>
        <StatTile value={`${summary.percentage}%`} label="Attendance" tint={color.primary} />
        <StatTile value={summary.present} label="Present days" tint={color.success} />
        <StatTile value={summary.late} label="Late marks" tint={summary.late > 0 ? color.warning : undefined} />
      </View>

      {/* notices & events (school calendar is live) */}
      <SectionCard heading="NOTICES & EVENTS">
        {nextHoliday ? (
          <ListRow
            leading={<TonalTile bg={color.errorContainer}><Icon name="campaign" size={19} tint={color.error} /></TonalTile>}
            title={nextHoliday.title}
            subtitle={new Date(nextHoliday.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          />
        ) : (
          <DSText variant="label">No notices right now.</DSText>
        )}
        <ListRow
          leading={<TonalTile bg={color.primaryContainer}><Icon name="event" size={19} tint={color.primary} /></TonalTile>}
          title="View full school calendar"
          subtitle="Holidays, exams and events"
          chevron
          onPress={() => router.push("/teacher/academics" as never)}
        />
      </SectionCard>

      <PressableScale
        accessibilityLabel="View attendance history"
        onPress={() => {
          router.push("/teacher/history" as never);
          toast.show("Opening your attendance history");
        }}
        style={styles.cta}
      >
        <Icon name="history" size={18} tint={color.primary} />
        <DSText variant="bodyMedium" tint={color.primary}>View full history</DSText>
      </PressableScale>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: space.sm },
  bell: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: color.surfaceVariant,
    alignItems: "center",
    justifyContent: "center"
  },
  bellDot: {
    position: "absolute",
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: color.error,
    borderWidth: 2,
    borderColor: color.surfaceVariant
  },
  heroTitle: { fontSize: 15, fontWeight: "600", color: color.onPrimary },
  heroMeta: { fontSize: 12.5, color: color.onPrimary, opacity: 0.8, marginTop: 2 },
  classRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: 10,
    paddingHorizontal: space.md,
    borderRadius: radius.sm + 2
  },
  classRowLive: { backgroundColor: color.primaryContainer },
  dot: { width: 8, height: 8, borderRadius: 4 },
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
  cta: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: color.faint,
    borderRadius: radius.md,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm
  }
});
