import React from "react";
import { StyleSheet, type StyleProp, type ViewStyle, View } from "react-native";

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e3e6f0",
    shadowColor: "#242a5e",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2
  }
});
