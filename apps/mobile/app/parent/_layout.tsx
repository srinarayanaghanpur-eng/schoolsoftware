/**
 * Parent group layout — scopes the shared child selection to every screen
 * in this group. (The visual chrome lives in features/parent/shell.tsx,
 * which each screen wraps itself in.)
 */
import React from "react";
import { Slot } from "expo-router";
import { SelectedChildProvider } from "@/features/parent/SelectedChild";

export default function ParentLayout() {
  return (
    <SelectedChildProvider>
      <Slot />
    </SelectedChildProvider>
  );
}
