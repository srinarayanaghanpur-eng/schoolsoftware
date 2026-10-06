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
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Avatar, DSText, EmptyState, ErrorState, Hero, Icon, ListRow, SkeletonPage,
  PillButton, PressableScale, ScreenHeader, SectionCard, StatTile, TonalTile, useToast
} from "@/design-system/components";
import { radius, space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import { useMobileSession } from "@/lib/mobileSession";
import { useTeacherAttendanceData } from "@/lib/useTeacherAttendanceData";
import { TeacherShell } from "@/features/teacher/shell";
import {
  dateLabel, formatTime, greeting, initials, statusTone, useAttendanceSummary
} from "@/features/teacher/hooks";

const QUICK_ACTIONS = [
  { key: "attendance", icon: "how-to-reg" as const, label: "Attendance", href: "/teacher/attendance", tone: "success" as const },
  { key: "academics", icon: "menu-book" as const, label: "Academics", href: "/teacher/academics", tone: "warning" as const },
  { key: "tasks", icon: "task-alt" as const, label: "Tasks", href: "/teacher/tasks", tone: "info" as const },
  { key: "inbox", icon: "mail-outline" as const, label: "Inbox", href: "/teacher/inbox", tone: "error" as const }
];

const QUICK_TONE = {
  success: { bg: "okBg", fg: "ok" },
  warning: { bg: "warnBg", fg: "warn" },
  info: { bg: "tint", fg: "blue" },
  error: { bg: "badBg", fg: "bad" }
} as const;

export default function TeacherHomeRoute() {
  return (
    <TeacherShell>
      <TeacherHome />
    </TeacherShell>
  );
}

function TeacherHome() {
  const { t } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { profile } = useMobileSession();
  const { teacher, records, holidays, loading, error } = useTeacherAttendanceData();
  const summary = useAttendanceSummary(records);

  if (loading && !teacher) return <SkeletonPage />;
  if (error && !teacher) return <ErrorState message={error} />;

  const name = teacher?.fullName ?? profile?.displayName ?? "Teacher";
  const today = statusTone(summary.today?.status);
  const nextHoliday = holidays
    .filter((h) => h.date >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader
        eyebrow={`${greeting()} · ${dateLabel()}`}
        title={name}
        trailing={
          <View style={styles.headerActions}>
            <PressableScale
              accessibilityLabel="Notifications"
              onPress={() => router.push("/teacher/inbox" as never)}
              style={[styles.bell, { backgroundColor: t.card, borderColor: t.line }]}
            >
              <Icon name="notifications" size={21} tint={t.mute} />
              <View style={[styles.bellDot, { backgroundColor: t.bad, borderColor: t.card }]} />
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
          <TonalTile bg={t.okBg} size={40}>
            <Icon name="check" size={22} tint={t.ok} />
          </TonalTile>
          <View style={{ flex: 1, minWidth: 0 }}>
            <DSText variant="bodyMedium" tint={t.ink}>
              Checked in · {formatTime(summary.today?.checkInTime)}
            </DSText>
            <DSText variant="label" tint={t.ok}>{today.label} today</DSText>
          </View>
          <PillButton
            label="Check out"
            bg={t.card}
            fg={t.ok}
            onPress={() => router.push("/teacher/attendance" as never)}
          />
        </Hero>
      ) : (
        <LinearGradient
          colors={[t.heroFrom, t.heroMid, t.heroTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <DSText variant="title" tint="#FFFFFF">
              {summary.checkedOut ? "Day complete" : "You haven’t checked in"}
            </DSText>
            <DSText variant="label" tint="rgba(255,255,255,0.85)" style={{ marginTop: 3 }}>
              {summary.checkedOut
                ? `Checked out at ${formatTime(summary.today?.checkOutTime)}`
                : `Location is verified before attendance is saved · ${dateLabel()}`}
            </DSText>
          </View>
          <PillButton
            label={summary.checkedOut ? "View" : "Check in"}
            bg="#FFFFFF"
            fg={t.blue}
            onPress={() => router.push("/teacher/attendance" as never)}
          />
        </LinearGradient>
      )}

      {/* today's classes — no timetable endpoint yet, so say so plainly */}
      <SectionCard
        heading="TODAY’S CLASSES"
        trailing={
          <PressableScale accessibilityLabel="Open timetable" onPress={() => router.push("/teacher/academics" as never)}>
            <DSText variant="bodyMedium" tint={t.blue}>Timetable</DSText>
          </PressableScale>
        }
      >
        <EmptyState icon="event" label="Your timetable will appear here once the school publishes it." />
      </SectionCard>

      {/* tasks — no tasks endpoint yet, so say so plainly */}
      <SectionCard heading="TASKS">
        <EmptyState icon="task-alt" label="Tasks from the principal will appear here." />
      </SectionCard>

      {/* quick actions */}
      <View style={styles.quickGrid}>
        {QUICK_ACTIONS.map((action) => {
          const tile = QUICK_TONE[action.tone];
          return (
            <PressableScale
              key={action.key}
              accessibilityLabel={action.label}
              onPress={() => router.push(action.href as never)}
              style={[styles.quickTile, { backgroundColor: t.card, borderColor: t.line }]}
            >
              <TonalTile bg={t[tile.bg]} size={40}>
                <Icon name={action.icon} size={22} tint={t[tile.fg]} />
              </TonalTile>
              <DSText variant="caption" tint={t.mute} style={{ fontWeight: "600" }}>{action.label}</DSText>
            </PressableScale>
          );
        })}
      </View>

      {/* month stats (live) */}
      <View style={styles.statRow}>
        <StatTile value={`${summary.percentage}%`} label="Attendance" tint={t.blue} />
        <StatTile value={summary.present} label="Present days" tint={t.ok} />
        <StatTile value={summary.late} label="Late marks" tint={summary.late > 0 ? t.warn : undefined} />
      </View>

      {/* notices & events (school calendar is live) */}
      <SectionCard heading="NOTICES & EVENTS">
        {nextHoliday ? (
          <ListRow
            leading={<TonalTile bg={t.badBg}><Icon name="campaign" size={19} tint={t.bad} /></TonalTile>}
            title={nextHoliday.title}
            subtitle={new Date(nextHoliday.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          />
        ) : (
          <DSText variant="label">No notices right now.</DSText>
        )}
        <ListRow
          leading={<TonalTile bg={t.tint}><Icon name="event" size={19} tint={t.blue} /></TonalTile>}
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
        style={[styles.cta, { borderColor: t.faint }]}
      >
        <Icon name="history" size={18} tint={t.blue} />
        <DSText variant="bodyMedium" tint={t.blue}>View full history</DSText>
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
    borderWidth: 1,
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
    borderWidth: 2
  },
  hero: {
    borderRadius: radius.xl,
    padding: space.lg,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  statRow: { flexDirection: "row", gap: 10 },
  quickGrid: { flexDirection: "row", gap: 10 },
  quickTile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: space.md + 2,
    paddingHorizontal: space.xs,
    alignItems: "center",
    gap: space.sm
  },
  cta: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: radius.lg,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm
  }
});
