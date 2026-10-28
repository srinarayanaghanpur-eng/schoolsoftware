/**
 * Help & support — school admin contact with tap-to-call.
 * The number loads from server settings (changeable without an app update)
 * and falls back to the baked-in number offline.
 * Shared by every role: admin / principal / accountant / teacher / parent.
 */
import React, { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Card, DSText, Icon, PillButton, SectionCard, TonalTile
} from "@/design-system/components";
import { space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import { auth } from "@/lib/firebase";
import { API_BASE_URL, API_REQUESTS_AVAILABLE } from "@/lib/api";
import { mobileCache } from "@/lib/cache/mobileCache";

const FALLBACK_PHONE = "6300038389";
const PHONE_CACHE_KEY = "support-contact";
const PHONE_CACHE_TTL_MINUTES = 60;

export default function SupportRoute() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, dark } = useTheme();
  const accent = dark ? t.blue2 : t.blue;
  const [adminPhone, setAdminPhone] = useState(FALLBACK_PHONE);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = await mobileCache.get<string>(PHONE_CACHE_KEY);
        if (cached && !cancelled) setAdminPhone(cached);
        if (!API_REQUESTS_AVAILABLE) return;
        const user = auth.currentUser;
        if (!user) return;
        const token = await user.getIdToken();
        const response = await fetch(`${API_BASE_URL}/api/portal/support-contact`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const result = (await response.json()) as { ok?: boolean; adminPhone?: string };
        const phone = typeof result.adminPhone === "string" ? result.adminPhone.trim() : "";
        if (response.ok && result.ok && phone && !cancelled) {
          setAdminPhone(phone);
          await mobileCache.set(PHONE_CACHE_KEY, phone, PHONE_CACHE_TTL_MINUTES);
        }
      } catch {
        // Offline or logged out: keep the cached/fallback number.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const callAdmin = () => {
    void Linking.openURL(`tel:${adminPhone}`);
  };

  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.lg }]}
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        accessibilityLabel="Go back"
        accessibilityRole="button"
        onPress={() => router.back()}
        style={styles.backRow}
      >
        <Icon name="arrow-back" size={20} tint={accent} />
        <DSText variant="bodyMedium" tint={accent}>Back</DSText>
      </Pressable>

      <View style={styles.hero}>
        <TonalTile bg={t.tint} size={64}>
          <Icon name="support-agent" size={32} tint={accent} />
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
            <DSText variant="title" style={styles.phone}>{adminPhone}</DSText>
            <DSText variant="label" tint={t.mute}>Tap below to call</DSText>
          </View>
        </Card>
        <PillButton
          label={`Call ${adminPhone}`}
          block
          bg={t.ok}
          fg={dark ? t.bg : t.card}
          icon="call"
          onPress={callAdmin}
        />
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
