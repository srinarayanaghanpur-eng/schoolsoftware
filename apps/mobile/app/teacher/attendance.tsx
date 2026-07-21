/**
 * Teacher Attendance — GPS check in / check out.
 * All business logic lives in features/teacher/useAttendanceMarking; this file
 * is presentation only.
 */
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Card, DSText, Hero, Icon, ListRow, PageTitle, PillButton, ProgressBar,
  SectionCard, TonalTile, useToast
} from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { useMobileSession } from "@/lib/mobileSession";
import { useTeacherAttendanceData } from "@/lib/useTeacherAttendanceData";
import { TeacherShell } from "@/features/teacher/shell";
import { useAttendanceMarking } from "@/features/teacher/useAttendanceMarking";
import { formatTime, useAttendanceSummary } from "@/features/teacher/hooks";

export default function TeacherAttendanceRoute() {
  return (
    <TeacherShell>
      <TeacherAttendance />
    </TeacherShell>
  );
}

function TeacherAttendance() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { profile } = useMobileSession();
  const { teacher, records } = useTeacherAttendanceData();
  const summary = useAttendanceSummary(records);
  const teacherId = teacher?.id ?? profile?.teacherId;
  const marking = useAttendanceMarking(teacherId);

  const proximity = marking.distance === null
    ? 0
    : Math.max(0, 100 - (marking.distance / marking.allowedRadius) * 100);

  async function handle(event: "check_in" | "check_out") {
    const result = await marking.mark(event);
    toast.show(result.message);
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xs }]}
      showsVerticalScrollIndicator={false}
    >
      <PageTitle>Attendance</PageTitle>

      {/* geofence status */}
      <Hero tone={marking.insideCampus ? "success" : "warning"}>
        <TonalTile
          bg={marking.insideCampus ? color.success : color.warningContainer}
          size={40}
        >
          <Icon
            name={marking.insideCampus ? "location-on" : "location-searching"}
            size={22}
            tint={marking.insideCampus ? color.onPrimary : color.warning}
          />
        </TonalTile>
        <View style={{ flex: 1, minWidth: 0 }}>
          <DSText
            variant="bodyMedium"
            tint={marking.insideCampus ? color.onSuccessContainer : color.onWarningDeep}
          >
            {marking.locating
              ? "Finding your location…"
              : marking.insideCampus
                ? "You’re on campus"
                : "Outside campus"}
          </DSText>
          <DSText
            variant="label"
            tint={marking.insideCampus ? color.success : color.warning}
          >
            {marking.distance === null
              ? `Allowed radius ${marking.allowedRadius} m`
              : `${marking.distance} m from campus · limit ${marking.allowedRadius} m`}
          </DSText>
        </View>
      </Hero>

      <Card style={{ gap: space.md }}>
        <DSText variant="overline">PROXIMITY</DSText>
        <ProgressBar
          percent={proximity}
          tint={marking.insideCampus ? color.success : color.warning}
        />
        <DSText variant="label">
          {marking.accuracy
            ? `GPS accuracy ±${Math.round(marking.accuracy)} m`
            : "Waiting for a GPS fix…"}
        </DSText>
      </Card>

      {marking.error ? (
        <Card style={styles.errorCard}>
          <Icon name="error-outline" size={20} tint={color.error} />
          <DSText variant="bodyMedium" tint={color.error} style={{ flex: 1 }}>
            {marking.error}
          </DSText>
        </Card>
      ) : null}

      {/* actions */}
      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <PillButton
            label={marking.submitting ? "Saving…" : "Check in"}
            block
            icon="fingerprint"
            bg={marking.insideCampus ? color.primary : color.outlineStrong}
            fg={marking.insideCampus ? color.onPrimary : color.muted}
            onPress={() => { if (!marking.submitting) void handle("check_in"); }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <PillButton
            label="Check out"
            block
            icon="logout"
            bg={color.surface}
            fg={color.primary}
            onPress={() => { if (!marking.submitting) void handle("check_out"); }}
          />
        </View>
      </View>

      <PillButton
        label={marking.locating ? "Locating…" : "Refresh location"}
        block
        icon="my-location"
        bg={color.surfaceVariant}
        fg={color.ink2}
        onPress={() => { void marking.refreshLocation(); }}
      />

      {/* today's record */}
      <SectionCard heading="TODAY’S RECORD">
        <ListRow
          leading={<TonalTile bg={color.primaryContainer}><Icon name="login" size={19} tint={color.primary} /></TonalTile>}
          title="Checked in"
          subtitle={formatTime(summary.today?.checkInTime)}
        />
        <ListRow
          leading={<TonalTile bg={color.surfaceVariant}><Icon name="logout" size={19} tint={color.ink2} /></TonalTile>}
          title="Checked out"
          subtitle={formatTime(summary.today?.checkOutTime)}
        />
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
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: color.errorContainer,
    borderColor: color.errorContainer,
    borderRadius: radius.md
  },
  actions: { flexDirection: "row", gap: space.md }
});
