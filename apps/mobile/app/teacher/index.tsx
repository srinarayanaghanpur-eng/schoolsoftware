/**
 * Teacher Home — implements the Home tab of the approved Teacher App design.
 * Wired to live attendance data; no fabricated numbers.
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
          <PressableScale accessibilityLabel="Profile" onPress={() => router.push("/teacher/profile" as never)}>
            <Avatar label={initials(name)} size={42} />
          </PressableScale>
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

      {/* month stats */}
      <View style={styles.statRow}>
        <StatTile value={`${summary.percentage}%`} label="Attendance" tint={color.primary} />
        <StatTile value={summary.present} label="Present days" tint={color.success} />
        <StatTile value={summary.late} label="Late marks" tint={summary.late > 0 ? color.warning : undefined} />
      </View>

      {/* today */}
      <SectionCard
        heading="TODAY"
        trailing={
          <Badge
            label={today.label}
            bg={
              today.tone === "success" ? color.successContainer
                : today.tone === "warning" ? color.warningContainer
                  : today.tone === "error" ? color.errorContainer
                    : color.surfaceVariant
            }
            fg={
              today.tone === "success" ? color.onSuccessContainer
                : today.tone === "warning" ? color.onWarningDeep
                  : today.tone === "error" ? color.error
                    : color.ink2
            }
          />
        }
      >
        <ListRow
          leading={<TonalTile bg={color.primaryContainer}><Icon name="login" size={19} tint={color.primary} /></TonalTile>}
          title="Check in"
          subtitle={formatTime(summary.today?.checkInTime)}
        />
        <ListRow
          leading={<TonalTile bg={color.surfaceVariant}><Icon name="logout" size={19} tint={color.ink2} /></TonalTile>}
          title="Check out"
          subtitle={formatTime(summary.today?.checkOutTime)}
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

      {/* upcoming holiday */}
      <SectionCard heading="UPCOMING">
        {nextHoliday ? (
          <ListRow
            leading={<TonalTile bg={color.errorContainer}><Icon name="event" size={19} tint={color.error} /></TonalTile>}
            title={nextHoliday.title}
            subtitle={new Date(nextHoliday.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          />
        ) : (
          <DSText variant="label">No holidays scheduled in the coming weeks.</DSText>
        )}
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
  heroTitle: { fontSize: 15, fontWeight: "600", color: color.onPrimary },
  heroMeta: { fontSize: 12.5, color: color.onPrimary, opacity: 0.8, marginTop: 2 },
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
