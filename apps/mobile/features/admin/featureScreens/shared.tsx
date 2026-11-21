import React from "react";
import { useRouter } from "expo-router";
import { DSText, Icon, PressableScale } from "@/design-system/components";
import { useTheme } from "@/lib/Theme";
import { useMobileSession } from "@/lib/mobileSession";
import { dashboardPathForRole } from "@/lib/roleRouting";
import { asDateString } from "@/lib/text";
import { styles } from "./styles";

export { styles };

export function formatDateTime(value?: unknown) {
  const text = typeof value === "string" ? value : asDateString(value, "");
  if (!text) return "—";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function useBasePath() {
  const { profile } = useMobileSession();
  return dashboardPathForRole(profile?.role);
}

export function ScreenBack() {
  const { t } = useTheme();
  const router = useRouter();
  return (
    <PressableScale
      accessibilityLabel="Go back"
      onPress={() => router.back()}
      style={styles.back}
    >
      <Icon name="arrow-back" size={18} tint={t.blue} />
      <DSText variant="bodyMedium" tint={t.blue}>Back</DSText>
    </PressableScale>
  );
}
