import React from "react";
import { Stack } from "expo-router";

export default function PrincipalLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: "fade" }} />;
}
