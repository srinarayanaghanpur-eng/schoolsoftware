/**
 * Teacher Profile — identity, attendance summary, menu, logout.
 */
import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Avatar, BottomSheet, DSText, Icon, ListRow, PillButton, ProgressRow, SectionCard, StatTile, TonalTile, useToast
} from "@/design-system/components";
import { radius, space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import { useMobileSession } from "@/lib/mobileSession";
import { useTeacherAttendanceData } from "@/lib/useTeacherAttendanceData";
import { workspaceLabel } from "@/lib/roleRouting";
import { TeacherShell } from "@/features/teacher/shell";
import { initials, useAttendanceSummary } from "@/features/teacher/hooks";
import { displayLoginContact } from "@/lib/text";

export default function TeacherProfileRoute() {
  return (
    <TeacherShell>
      <TeacherProfile />
    </TeacherShell>
  );
}

function TeacherProfile() {
  const { t } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const session = useMobileSession();
  const { teacher, records } = useTeacherAttendanceData();
  const summary = useAttendanceSummary(records);

  const name = teacher?.fullName ?? session.profile?.displayName ?? "Teacher";

  const logout = async () => {
    try {
      await session.logout();
      router.replace("/login" as never);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Logout failed. Please try again.");
    }
  };

  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmLogout = () => setConfirmOpen(true);

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={[t.heroFrom, t.heroMid, t.heroTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.identityCard}
      >
        <Avatar label={initials(name)} size={64} bg="rgba(255,255,255,0.22)" fg="#FFFFFF" />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <DSText variant="title" tint="#FFFFFF" style={{ fontSize: 19 }} numberOfLines={1}>{name}</DSText>
          <DSText variant="label" tint="rgba(255,255,255,0.85)">
            {workspaceLabel(session.profile?.role)}
            {teacher?.subject ? ` · ${teacher.subject}` : ""}
          </DSText>
          <DSText variant="label" tint="rgba(255,255,255,0.85)">
            {teacher?.employeeId ?? displayLoginContact(session.profile)}
          </DSText>
        </View>
      </LinearGradient>

      <View style={styles.statRow}>
        <StatTile value={`${summary.percentage}%`} label="Attendance" tint={t.blue} />
        <StatTile value={summary.present} label="Present" tint={t.ok} />
        <StatTile value={summary.late} label="Late" tint={t.warn} />
      </View>

      <SectionCard heading="THIS MONTH">
        <ProgressRow
          label="Attendance rate"
          percent={summary.percentage}
          tint={summary.percentage >= 90 ? t.ok : t.warn}
        />
      </SectionCard>

      <SectionCard heading="MY DETAILS">
        <ListRow
          leading={<TonalTile bg={t.tint}><Icon name="badge" size={19} tint={t.blue} /></TonalTile>}
          title="Employee ID"
          subtitle={teacher?.employeeId ?? "Not set"}
        />
        <ListRow
          leading={<TonalTile bg={t.warnBg}><Icon name="phone" size={19} tint={t.warn} /></TonalTile>}
          title="Phone"
          subtitle={teacher?.phone ?? "Not set"}
        />
        <ListRow
          leading={<TonalTile bg={t.okBg}><Icon name="fingerprint" size={19} tint={t.ok} /></TonalTile>}
          title="Biometric ID"
          subtitle={teacher?.biometricUserId ?? "Not enrolled"}
        />
      </SectionCard>

      <SectionCard heading="MORE">
        <ListRow
          leading={<TonalTile bg={t.tint}><Icon name="history" size={19} tint={t.blue} /></TonalTile>}
          title="Attendance history"
          chevron
          onPress={() => router.push("/teacher/history" as never)}
        />
        <ListRow
          leading={<TonalTile bg={t.warnBg}><Icon name="description" size={19} tint={t.warn} /></TonalTile>}
          title="Documents & payslips"
          subtitle="Available in the web portal"
          chevron
          onPress={() => toast.show("Open the web portal for downloads.")}
        />
        <ListRow
          leading={<TonalTile bg={t.badBg}><Icon name="help-outline" size={19} tint={t.bad} /></TonalTile>}
          title="Help & support"
          chevron
          onPress={() => toast.show("Contact the school office for help.")}
        />
      </SectionCard>

      <DSText variant="caption" style={{ textAlign: "center" }}>
        Your details are managed by the school office.
      </DSText>

      <PillButton label="Logout from this device" block bg={t.bad} icon="logout" onPress={confirmLogout} />

      <BottomSheet
        visible={confirmOpen}
        title="Log out?"
        onClose={() => setConfirmOpen(false)}
      >
        <DSText variant="label">You are getting logged out from this device.</DSText>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
          <View style={{ flex: 1 }}>
            <PillButton label="Stay" block onPress={() => setConfirmOpen(false)} />
          </View>
          <View style={{ flex: 1 }}>
            <PillButton
              label="Log out"
              block
              bg={t.bad}
              fg="#FFFFFF"
              onPress={() => { setConfirmOpen(false); void logout(); }}
            />
          </View>
        </View>
      </BottomSheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 },
  identityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: radius.xl,
    padding: space.lg
  },
  statRow: { flexDirection: "row", gap: 10 }
});
