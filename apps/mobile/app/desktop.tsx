/**
 * Settings-manager landing. This role's tools are desktop-only, so rather
 * than dropping the user on a dead-end profile screen (the old behaviour),
 * the app says so plainly and offers a logout.
 */
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Avatar, DSText, Icon, PillButton, SectionCard, ListRow, ToastProvider, useToast
} from "@/design-system/components";
import { color, space } from "@/design-system/tokens";
import { useMobileSession } from "@/lib/mobileSession";
import { workspaceLabel } from "@/lib/roleRouting";
import { initials } from "@/features/teacher/hooks";

export default function DesktopOnlyRoute() {
  return (
    <ToastProvider>
      <DesktopOnly />
    </ToastProvider>
  );
}

function DesktopOnly() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const session = useMobileSession();
  const name = session.profile?.displayName ?? "User";

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
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xxl }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.identityRow}>
        <Avatar label={initials(name)} size={64} bg={color.ink3} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <DSText variant="title" style={{ fontSize: 19 }} numberOfLines={1}>{name}</DSText>
          <DSText variant="label">{workspaceLabel(session.profile?.role)}</DSText>
        </View>
      </View>

      <SectionCard heading="THIS ROLE IS DESKTOP ONLY">
        <DSText variant="body">
          Settings management needs the full dashboard — school configuration,
          roles and permissions aren’t available on mobile. Sign in on a
          computer to continue.
        </DSText>
        <ListRow
          leading={<Icon name="computer" size={21} tint={color.primary} />}
          title="Open the web dashboard"
          subtitle="Use the same login details"
        />
      </SectionCard>

      <PillButton label="Logout from this device" block bg={color.error} icon="logout" onPress={logout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14, backgroundColor: color.background, flexGrow: 1 },
  identityRow: { flexDirection: "row", alignItems: "center", gap: 14 }
});
