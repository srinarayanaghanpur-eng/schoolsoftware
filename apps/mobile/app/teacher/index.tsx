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
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Avatar, DSText, EmptyState, ErrorState, Hero, Icon, ListRow, LoadingState,
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
  { key: "attendance", icon: "how-to-reg" as const, label: "Attendance", href: "/teacher/attendance", tile: color.tileLavender },
  { key: "academics", icon: "menu-book" as const, label: "Academics", href: "/teacher/academics", tile: color.tilePeach },
  { key: "tasks", icon: "task-alt" as const, label: "Tasks", href: "/teacher/tasks", tile: color.tileMint },
  { key: "inbox", icon: "mail-outline" as const, label: "Inbox", href: "/teacher/inbox", tile: color.tileSky }
];

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

      {/* check-in hero — bold Zepto purple prompt card */}
      {summary.checkedIn ? (
        <Hero tone="success">
          <TonalTile bg={color.tileMint} size={40}>
            <Icon name="check" size={22} tint={color.success} />
          </TonalTile>
          <View style={{ flex: 1, minWidth: 0 }}>
            <DSText variant="bodyMedium" tint={color.onSuccessContainer}>
              Checked in · {formatTime(summary.today?.checkInTime)}
            </DSText>
            <DSText variant="label" tint={color.success}>{today.label} today</DSText>
          </View>
          <PillButton
            label="Check out"
            bg={color.surface}
            fg={color.success}
            onPress={() => router.push("/teacher/attendance" as never)}
          />
        </Hero>
      ) : (
        <Hero style={{ backgroundColor: color.primary }}>
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
            fg={color.primary}
            onPress={() => router.push("/teacher/attendance" as never)}
          />
        </Hero>
      )}

      {/* today's classes — no timetable endpoint yet, so say so plainly */}
      <SectionCard
        heading="TODAY’S CLASSES"
        trailing={
          <PressableScale accessibilityLabel="Open timetable" onPress={() => router.push("/teacher/academics" as never)}>
            <DSText variant="bodyMedium" tint={color.primary}>Timetable</DSText>
          </PressableScale>
        }
      >
        <EmptyState icon="event" label="Your timetable will appear here once the school publishes it." />
      </SectionCard>

      {/* tasks — no tasks endpoint yet, so say so plainly */}
      <SectionCard heading="TASKS">
        <EmptyState icon="task-alt" label="Tasks from the principal will appear here." />
      </SectionCard>

      {/* quick actions — white cards with Zepto pastel icon tiles */}
      <View style={styles.quickGrid}>
        {QUICK_ACTIONS.map((action) => (
          <PressableScale
            key={action.key}
            accessibilityLabel={action.label}
            onPress={() => router.push(action.href as never)}
            style={styles.quickTile}
          >
            <TonalTile bg={action.tile} size={40}>
              <Icon name={action.icon} size={22} tint={color.primary} />
            </TonalTile>
            <DSText variant="caption" tint={color.ink2} style={{ fontWeight: "600" }}>{action.label}</DSText>
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
            leading={<TonalTile bg={color.tileRose}><Icon name="campaign" size={19} tint={color.error} /></TonalTile>}
            title={nextHoliday.title}
            subtitle={new Date(nextHoliday.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          />
        ) : (
          <DSText variant="label">No notices right now.</DSText>
        )}
        <ListRow
          leading={<TonalTile bg={color.tileSky}><Icon name="event" size={19} tint={color.primary} /></TonalTile>}
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
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.outline,
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
    borderColor: color.surface
  },
  heroTitle: { fontSize: 17, fontWeight: "700", color: color.onPrimary },
  heroMeta: { fontSize: 12.5, color: color.onPrimary, opacity: 0.85, marginTop: 3 },
  statRow: { flexDirection: "row", gap: 10 },
  quickGrid: { flexDirection: "row", gap: 10 },
  quickTile: {
    flex: 1,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.outline,
    borderRadius: radius.lg,
    paddingVertical: space.md + 2,
    paddingHorizontal: space.xs,
    alignItems: "center",
    gap: space.sm
  },
  cta: {
    backgroundColor: color.surface,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: color.faint,
    borderRadius: radius.lg,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm
  }
});
