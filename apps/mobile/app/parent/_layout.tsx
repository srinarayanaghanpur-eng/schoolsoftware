/**
 * Parent group layout — pure passthrough.
 * The workspace chrome lives in features/parent/shell.tsx, which each screen
 * wraps itself in, so screens render correctly regardless of route nesting.
 */
import React from "react";
import { Slot } from "expo-router";

export default function ParentLayout() {
  return <Slot />;
}
