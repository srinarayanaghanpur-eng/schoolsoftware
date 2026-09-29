/**
 * ChildSwitcher — horizontal chip selector shown when a parent has more than
 * one linked child. Shared by the Phase 4 fees and attendance screens.
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { DSText } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import type { PortalStudent } from "./api";

export function ChildSwitcher({
  children,
  selectedId,
  onSelect
}: {
  children: PortalStudent[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  if (children.length < 2) return null;
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {children.map((child) => {
        const active = child.id === selectedId;
        return (
          <Pressable
            key={child.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={child.name}
            onPress={() => onSelect(child.id)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <DSText variant="label" style={active ? styles.labelActive : undefined}>
              {child.name.split(" ")[0]}
            </DSText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceVariant
  },
  chipActive: { backgroundColor: color.primaryContainer },
  labelActive: { fontWeight: "700" }
});
