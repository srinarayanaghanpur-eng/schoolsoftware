/**
 * Teacher Attendance — GPS check in / check out.
 * All business logic lives in features/teacher/useAttendanceMarking; this file
 * is presentation only.
 */
import React, { useMemo } from "react";
import { Linking, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  Card, DSText, Hero, Icon, PillButton, ProgressBar,
  ScreenHeader, SectionCard, StatTile, TonalTile, useToast
} from "@/design-system/components";
import { space, radius } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import { MonthCalendar, ProgressRing, type DayMark } from "@/design-system/widgets";
import { useMobileSession } from "@/lib/mobileSession";
import { useTeacherAttendanceData } from "@/lib/useTeacherAttendanceData";
import { TeacherShell } from "@/features/teacher/shell";
import { useAttendanceMarking } from "@/features/teacher/useAttendanceMarking";
import { proximityState } from "@/features/teacher/proximity";
import {
  dateLabel, formatTime, greeting, statusTone, useAttendanceSummary
} from "@/features/teacher/hooks";

export default function TeacherAttendanceRoute() {
  return (
    <TeacherShell>
      <TeacherAttendance />
    </TeacherShell>
  );
}

function TeacherAttendance() {
  const { t } = useTheme();
  const toast = useToast();
  const { profile } = useMobileSession();
  const { teacher, records, loading, refresh } = useTeacherAttendanceData();
  const summary = useAttendanceSummary(records);
  const teacherId = teacher?.id ?? profile?.teacherId;
  const marking = useAttendanceMarking(teacherId);

  // Plain-language location state. Raw metres/accuracy stay in the request
  // payload and server record — they are never rendered here.
  const denied = marking.permission === "denied";
  const firstFix = marking.locating && marking.distance === null && !marking.error && !denied;
  const state =
    denied || marking.distance === null
      ? null
      : Platform.OS === "web"
        ? {
            kind: "weak" as const,
            text: "Check-in needs the mobile app — this browser preview can\u2019t verify your location."
          }
        : proximityState(
            marking.distance,
            marking.accuracy ?? Number.POSITIVE_INFINITY,
            marking.allowedRadius
          );

  const canCheckIn =
    !denied && !firstFix && !marking.submitting && state?.kind === "ok";
  const showProximity =
    state !== null &&
    (state.kind === "ok" || state.kind === "near") &&
    (marking.distance ?? Number.POSITIVE_INFINITY) < 500;
  const closeness =
    marking.distance === null
      ? 0
      : Math.max(0, Math.min(100, 100 - (marking.distance / marking.allowedRadius) * 100));

  const heroLook =
    firstFix || state === null
      ? {
          tone: "warning" as const,
          tileBg: t.warnBg,
          tint: t.warn,
          icon: "location-searching" as const,
          text: "Getting your location…"
        }
      : state.kind === "ok"
        ? { tone: "success" as const, tileBg: t.okBg, tint: t.ok, icon: "location-on" as const, text: state.text }
        : state.kind === "near"
          ? { tone: "warning" as const, tileBg: t.warnBg, tint: t.warn, icon: "location-searching" as const, text: state.text }
          : state.kind === "far"
            ? { tone: "warning" as const, tileBg: t.badBg, tint: t.bad, icon: "location-off" as const, text: state.text }
            : { tone: "warning" as const, tileBg: t.warnBg, tint: t.warn, icon: "location-searching" as const, text: state.text };

  const name = teacher?.fullName ?? profile?.displayName ?? "Teacher";
  const todayTone = statusTone(summary.today?.status);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const leaveCount = useMemo(
    () => records.filter((record) => record.status === "cl").length,
    [records]
  );

  const marks = useMemo(() => {
    const result: Record<number, DayMark> = {};
    for (const record of records) {
      const parts = record.date.split("-");
      const y = Number(parts[0]);
      const m = Number(parts[1]);
      const d = Number(parts[2]);
      if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) continue;
      if (y !== year || m !== month) continue;
      if (record.status === "present") result[d] = "P";
      else if (record.status === "absent") result[d] = "A";
      else if (record.status === "late" || record.status === "half_day") result[d] = "L";
    }
    return result;
  }, [records, year, month]);

  async function handle(event: "checkin" | "checkout") {
    const result = await marking.mark(event);
    toast.show(result.message);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={t.blue} />}
    >
      <ScreenHeader
        eyebrow={`${greeting()} · ${dateLabel()}`}
        title={name}
      />

      {/* today's status ring — center label is the live check-in time */}
      <Card style={styles.ringCard}>
        <ProgressRing progress={summary.percentage / 100}>
          <View style={styles.ringCenter}>
            <DSText variant="title" style={styles.ringTime}>
              {formatTime(summary.today?.checkInTime)}
            </DSText>
            <DSText variant="label">
              {summary.checkedIn ? "Checked in" : todayTone.label}
            </DSText>
          </View>
        </ProgressRing>
        <View style={styles.ringMeta}>
          <View style={styles.ringMetaItem}>
            <DSText variant="label">Check in</DSText>
            <DSText variant="bodyMedium">{formatTime(summary.today?.checkInTime)}</DSText>
          </View>
          <View style={styles.ringMetaItem}>
            <DSText variant="label">Check out</DSText>
            <DSText variant="bodyMedium">{formatTime(summary.today?.checkOutTime)}</DSText>
          </View>
          <View style={styles.ringMetaItem}>
            <DSText variant="label">Month</DSText>
            <DSText variant="bodyMedium">{`${summary.percentage}%`}</DSText>
          </View>
        </View>
      </Card>

      {/* location status — plain words, never raw metres */}
      {denied ? (
        <Card style={[styles.rowCard, { backgroundColor: t.badBg, borderColor: t.badBg }]}>
          <TonalTile bg={t.card} size={36}>
            <Icon name="location-off" size={20} tint={t.bad} />
          </TonalTile>
          <DSText variant="bodyMedium" tint={t.bad} style={{ flex: 1 }}>
            Location permission is off, so attendance can’t be marked.
          </DSText>
          <PillButton
            label="Open settings"
            icon="settings"
            bg={t.card}
            fg={t.bad}
            onPress={() => { void Linking.openSettings(); }}
          />
        </Card>
      ) : (
        <Hero tone={heroLook.tone}>
          <TonalTile bg={heroLook.tileBg} size={40}>
            <Icon name={heroLook.icon} size={22} tint={heroLook.tint} />
          </TonalTile>
          <View style={{ flex: 1, minWidth: 0 }}>
            <DSText variant="bodyMedium">{heroLook.text}</DSText>
          </View>
        </Hero>
      )}

      {showProximity ? (
        <Card style={{ gap: space.md }}>
          <DSText variant="overline">PROXIMITY</DSText>
          <ProgressBar
            percent={closeness}
            tint={state?.kind === "ok" ? t.ok : t.warn}
          />
        </Card>
      ) : null}

      {!denied && marking.error ? (
        <Card style={[styles.rowCard, { backgroundColor: t.badBg, borderColor: t.badBg }]}>
          <TonalTile bg={t.card} size={36}>
            <Icon name="error-outline" size={20} tint={t.bad} />
          </TonalTile>
          <DSText variant="bodyMedium" tint={t.bad} style={{ flex: 1 }}>
            {marking.error}
          </DSText>
        </Card>
      ) : null}

      {/* offline backlog */}
      {marking.pendingCount > 0 ? (
        <Card style={[styles.rowCard, { backgroundColor: t.warnBg, borderColor: t.warnBg }]}>
          <TonalTile bg={t.card} size={36}>
            <Icon name="cloud-upload" size={20} tint={t.warn} />
          </TonalTile>
          <DSText variant="bodyMedium" style={{ flex: 1 }}>
            {marking.pendingCount} {marking.pendingCount === 1 ? "attempt" : "attempts"} pending sync
          </DSText>
          <PillButton
            label={marking.syncing ? "Syncing…" : "Retry now"}
            icon="refresh"
            bg={t.card}
            fg={t.warn}
            onPress={() => {
              if (!marking.syncing) {
                void marking.retryPending().then((result) => toast.show(result.message));
              }
            }}
          />
        </Card>
      ) : null}

      {/* actions — check in needs a fresh on-campus fix, check out unchanged */}
      <View style={styles.actions}>
        {canCheckIn ? (
          <PillButton
            label={marking.submitting ? "Saving…" : "Check in"}
            block
            icon="fingerprint"
            bg={t.blue}
            fg="#FFFFFF"
            onPress={() => { if (!marking.submitting) void handle("checkin"); }}
          />
        ) : (
          <View
            accessibilityRole="button"
            accessibilityLabel="Check in (unavailable)"
            accessibilityState={{ disabled: true }}
            style={[styles.disabledBtn, { backgroundColor: t.line }]}
          >
            <Icon name="fingerprint" size={17} tint={t.mute} />
            <Text style={[styles.disabledBtnText, { color: t.mute }]}>
              {marking.submitting ? "Saving…" : "Check in"}
            </Text>
          </View>
        )}
        <PillButton
          label="Check out"
          block
          icon="logout"
          bg={t.card}
          fg={t.blue}
          onPress={() => { if (!marking.submitting) void handle("checkout"); }}
        />
      </View>

      <PillButton
        label={marking.locating ? "Locating…" : "Refresh location"}
        block
        icon="my-location"
        bg={t.card}
        fg={t.mute}
        onPress={() => { void marking.refreshLocation(); }}
      />

      {/* month KPIs (live) */}
      <View style={styles.statRow}>
        <StatTile value={summary.present} label="Present" tint={t.ok} />
        <StatTile value={summary.absent} label="Absent" tint={t.bad} />
        <StatTile value={leaveCount} label="Leave" tint={t.warn} />
      </View>

      {/* month calendar (live records) */}
      <SectionCard heading="THIS MONTH">
        <MonthCalendar year={year} month={month} marks={marks} today={now.getDate()} />
      </SectionCard>

      <DSText variant="caption" style={{ textAlign: "center" }}>
        Your location is checked only at the moment you mark attendance. It is
        never tracked in the background.
      </DSText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 },
  ringCard: { gap: space.md, alignItems: "center" },
  ringCenter: { alignItems: "center", gap: 2 },
  ringTime: { fontSize: 22, fontWeight: "700" },
  ringMeta: { flexDirection: "row", gap: space.md, alignSelf: "stretch" },
  ringMetaItem: { flex: 1, alignItems: "center", gap: 2 },
  rowCard: { flexDirection: "row", alignItems: "center", gap: space.md },
  actions: { gap: space.md },
  disabledBtn: {
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    opacity: 0.55
  },
  disabledBtnText: { fontSize: 13, fontWeight: "600" },
  statRow: { flexDirection: "row", gap: 10 }
});
