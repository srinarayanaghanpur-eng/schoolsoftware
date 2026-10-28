import React from "react";
import { Stack } from "expo-router";
import { useTheme } from "@/lib/Theme";

export function ThemedStack({
  animation
}: {
  animation?: "fade" | "none";
}) {
  const { t } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: t.bg },
        ...(animation ? { animation } : {})
      }}
    />
  );
}
