/**
 * Teacher Profile — identity, attendance summary, menu, logout.
 */
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Avatar, DSText, Icon, ListRow, PillButton, ProgressRow, SectionCard, StatTile, useToast
} from "@/design-system/components";
import { color, space } from "@/design-system/tokens";
import { useMobileSession } from "@/lib/mobileSession";
import { useTeacherAttendanceData } from "@/lib/useTeacherAttendanceData";
import { workspaceLabel } from "@/lib/roleRouting";
import { TeacherShell } from "@/features/teacher/shell";
import { initials, useAttendanceSummary } from "@/features/teacher/hooks";

export default function TeacherProfileRoute() {
  return (
    <TeacherShell>
      <TeacherProfile />
    </TeacherShell>
  );
}

function TeacherProfile() {
  const insets = useSafeAreaInsets();
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

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.sm }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.identityRow}>
        <Avatar label={initials(name)} size={64} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <DSText variant="title" style={{ fontSize: 19 }} numberOfLines={1}>{name}</DSText>
          <DSText variant="label">
            {workspaceLabel(session.profile?.role)}
            {teacher?.subject ? ` · ${teacher.subject}` : ""}
          </DSText>
          <DSText variant="label">
            {teacher?.employeeId ?? session.profile?.employeeId ?? session.profile?.email ?? ""}
          </DSText>
        </View>
      </View>

      <View style={styles.statRow}>
        <StatTile value={`${summary.percentage}%`} label="Attendance" tint={color.primary} />
        <StatTile value={summary.present} label="Present" tint={color.success} />
        <StatTile value={summary.late} label="Late" tint={color.warning} />
      </View>

      <SectionCard heading="THIS MONTH">
        <ProgressRow
          label="Attendance rate"
          percent={summary.percentage}
          tint={summary.percentage >= 90 ? color.success : color.warning}
        />
      </SectionCard>

      <SectionCard heading="MY DETAILS">
        <ListRow
          leading={<Icon name="badge" size={21} tint={color.primary} />}
          title="Employee ID"
          subtitle={teacher?.employeeId ?? "Not set"}
        />
        <ListRow
          leading={<Icon name="phone" size={21} tint={color.primary} />}
          title="Phone"
          subtitle={teacher?.phone ?? "Not set"}
        />
        <ListRow
          leading={<Icon name="fingerprint" size={21} tint={color.primary} />}
          title="Biometric ID"
          subtitle={teacher?.biometricUserId ?? "Not enrolled"}
        />
      </SectionCard>

      <SectionCard heading="MORE">
        <ListRow
          leading={<Icon name="history" size={21} tint={color.primary} />}
          title="Attendance history"
          chevron
          onPress={() => router.push("/teacher/history" as never)}
        />
        <ListRow
          leading={<Icon name="description" size={21} tint={color.primary} />}
          title="Documents & payslips"
          subtitle="Available in the web portal"
          chevron
          onPress={() => toast.show("Open the web portal for downloads.")}
        />
        <ListRow
          leading={<Icon name="help-outline" size={21} tint={color.primary} />}
          title="Help & support"
          chevron
          onPress={() => toast.show("Contact the school office for help.")}
        />
      </SectionCard>

      <DSText variant="caption" style={{ textAlign: "center" }}>
        Your details are managed by the school office.
      </DSText>

      <PillButton label="Logout from this device" block bg={color.error} icon="logout" onPress={logout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 },
  identityRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 10 },
  statRow: { flexDirection: "row", gap: 10 }
});
