/**
 * Core design-system components. Every screen composes from these —
 * no screen defines its own StyleSheet.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { color, elevation, motion, radius, space, type } from "./tokens";

type IconName = React.ComponentProps<typeof MaterialIcons>["name"];

/* ---------------------------------------------------------------- Icon */
export function Icon({ name, size = 21, tint = color.ink2 }: { name: IconName; size?: number; tint?: string }) {
  return <MaterialIcons name={name} size={size} color={tint} />;
}

/* ---------------------------------------------------------------- Text */
export function DSText({
  variant = "body",
  tint,
  style,
  children,
  ...rest
}: React.ComponentProps<typeof Text> & { variant?: keyof typeof type; tint?: string }) {
  return (
    <Text {...rest} style={[type[variant], tint ? { color: tint } : null, style]}>
      {children}
    </Text>
  );
}

/* ---------------------------------------------------------------- Card */
export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Section card with an overline heading, as used throughout the design. */
export function SectionCard({
  heading,
  trailing,
  children,
  style
}: {
  heading: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Card style={[styles.sectionCard, style]}>
      <View style={styles.sectionHeader}>
        <DSText variant="overline" style={{ flex: 1 }}>{heading}</DSText>
        {trailing}
      </View>
      {children}
    </Card>
  );
}

/* ---------------------------------------------------------------- Pressables */
export function PressableScale({
  onPress,
  children,
  style,
  accessibilityLabel
}: {
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [style, pressed && { transform: [{ scale: motion.pressScale }], opacity: 0.92 }]}
    >
      {children}
    </Pressable>
  );
}

export function PillButton({
  label,
  onPress,
  bg = color.primary,
  fg = color.onPrimary
}: {
  label: string;
  onPress?: () => void;
  bg?: string;
  fg?: string;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} style={[styles.pillButton, { backgroundColor: bg }]}>
      <Text style={[styles.pillButtonText, { color: fg }]}>{label}</Text>
    </PressableScale>
  );
}

/* ---------------------------------------------------------------- Avatar */
export function Avatar({
  label,
  size = 44,
  bg = color.primary,
  fg = color.onPrimary
}: {
  label: string;
  size?: number;
  bg?: string;
  fg?: string;
}) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: fg, fontSize: size * 0.32, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

/** Square tonal tile (subject codes, notice icons). */
export function TonalTile({
  bg,
  children,
  size = 38
}: {
  bg: string;
  children: React.ReactNode;
  size?: number;
}) {
  return (
    <View style={{ width: size, height: size, borderRadius: radius.sm, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
      {children}
    </View>
  );
}

/* ---------------------------------------------------------------- Badge */
export function Badge({
  label,
  bg = color.warningContainer,
  fg = color.onWarningDeep
}: {
  label: string;
  bg?: string;
  fg?: string;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function UnreadDot({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={styles.unread}>
      <Text style={styles.unreadText}>{count}</Text>
    </View>
  );
}

/* ---------------------------------------------------------------- List row */
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  chevron = false
}: {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
}) {
  const body = (
    <View style={styles.listRow}>
      {leading}
      <View style={{ flex: 1, minWidth: 0 }}>
        <DSText variant="bodyMedium" numberOfLines={1}>{title}</DSText>
        {subtitle ? <DSText variant="label" numberOfLines={1} style={{ marginTop: 2 }}>{subtitle}</DSText> : null}
      </View>
      {trailing}
      {chevron ? <Icon name="chevron-right" size={20} tint={color.faint} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && { backgroundColor: color.surfaceVariant, borderRadius: radius.sm }}>
      {body}
    </Pressable>
  );
}

/* ---------------------------------------------------------------- States */
export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <View style={styles.stateWrap}>
      <DSText variant="label">{label}</DSText>
    </View>
  );
}

export function EmptyState({ icon = "inbox", label }: { icon?: IconName; label: string }) {
  return (
    <View style={styles.stateWrap}>
      <Icon name={icon} size={28} tint={color.faint} />
      <DSText variant="label" style={{ marginTop: space.sm, textAlign: "center" }}>{label}</DSText>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.stateWrap}>
      <Icon name="error-outline" size={28} tint={color.error} />
      <DSText variant="label" tint={color.error} style={{ marginTop: space.sm, textAlign: "center" }}>{message}</DSText>
      {onRetry ? <View style={{ marginTop: space.md }}><PillButton label="Retry" onPress={onRetry} /></View> : null}
    </View>
  );
}

/* ---------------------------------------------------------------- Toast */
const ToastContext = createContext<{ show: (msg: string) => void }>({ show: () => undefined });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((msg: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(msg);
    Animated.timing(anim, { toValue: 1, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setMessage(null));
    }, motion.toastDuration);
  }, [anim]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {message ? (
        <Animated.View
          accessibilityLiveRegion="polite"
          style={[styles.toast, elevation.toast, {
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }]
          }]}
        >
          <Icon name="check-circle" size={17} tint={color.inverseAccent} />
          <Text style={styles.toastText}>{message}</Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/* ---------------------------------------------------------------- styles */
const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.outline,
    borderRadius: radius.xl,
    padding: 14,
    paddingHorizontal: space.lg,
    ...elevation.card
  },
  sectionCard: { gap: space.md },
  sectionHeader: { flexDirection: "row", alignItems: "center" },
  pillButton: { borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 10, alignSelf: "flex-start" },
  pillButtonText: { fontSize: 13, fontWeight: "600" },
  badge: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3, alignSelf: "flex-start" },
  badgeText: { fontSize: 11.5, fontWeight: "700" },
  unread: {
    backgroundColor: color.primary,
    minWidth: 18,
    height: 18,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5
  },
  unreadText: { color: color.onPrimary, fontSize: 10.5, fontWeight: "700" },
  listRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: 2 },
  stateWrap: { alignItems: "center", justifyContent: "center", paddingVertical: space.xxl },
  toast: {
    position: "absolute",
    left: space.lg,
    right: space.lg,
    bottom: 24,
    backgroundColor: color.inverseSurface,
    borderRadius: radius.sm,
    paddingHorizontal: space.lg,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    zIndex: 60
  },
  toastText: { color: color.onPrimary, fontSize: 13.5, flex: 1 }
});
