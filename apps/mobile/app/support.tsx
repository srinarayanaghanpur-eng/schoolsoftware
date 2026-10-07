/**
 * Help & support — fully static page (NO Firebase, NO network).
 * Shows the school admin contact: tap the number to call 6300038389.
 * Shared by every role: admin / principal / accountant / teacher / parent.
 */
import React from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Card, DSText, Icon, PillButton, SectionCard, TonalTile
} from "@/design-system/components";
import { space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";

const ADMIN_PHONE = "6300038389";

export default function SupportRoute() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTheme();

  const callAdmin = () => {
    void Linking.openURL(`tel:${ADMIN_PHONE}`);
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.lg }]}
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        accessibilityLabel="Go back"
        accessibilityRole="button"
        onPress={() => router.back()}
        style={styles.backRow}
      >
        <Icon name="arrow-back" size={20} tint={t.blue} />
        <DSText variant="bodyMedium" tint={t.blue}>Back</DSText>
      </Pressable>

      <View style={styles.hero}>
        <TonalTile bg={t.tint} size={64}>
          <Icon name="support-agent" size={32} tint={t.blue} />
        </TonalTile>
        <DSText variant="title" style={styles.title}>Help & support</DSText>
        <DSText variant="body" tint={t.mute} style={styles.subtitle}>
          Questions about fees, attendance or the app? Contact the school admin.
        </DSText>
      </View>

      <SectionCard heading="CONTACT THE ADMIN">
        <Card style={[styles.contactCard, { backgroundColor: t.card, borderColor: t.line }]}>
          <TonalTile bg={t.okBg} size={48}>
            <Icon name="call" size={24} tint={t.ok} />
          </TonalTile>
          <View style={styles.contactText}>
            <DSText variant="label" tint={t.mute}>SCHOOL ADMIN</DSText>
            <DSText variant="title" style={styles.phone}>{ADMIN_PHONE}</DSText>
            <DSText variant="label" tint={t.mute}>Tap below to call</DSText>
          </View>
        </Card>
        <PillButton label={`Call ${ADMIN_PHONE}`} block bg={t.ok} icon="call" onPress={callAdmin} />
      </SectionCard>

      <DSText variant="caption" tint={t.mute} style={styles.note}>
        For anything urgent, please visit the school office directly.
      </DSText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: space.lg, flexGrow: 1 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  hero: { alignItems: "center", gap: 8, paddingVertical: space.md },
  title: { fontSize: 22, textAlign: "center" },
  subtitle: { textAlign: "center" },
  contactCard: { flexDirection: "row", alignItems: "center", gap: space.md, borderWidth: 1 },
  contactText: { flex: 1, gap: 2 },
  phone: { fontSize: 24, letterSpacing: 1 },
  note: { textAlign: "center" }
});
