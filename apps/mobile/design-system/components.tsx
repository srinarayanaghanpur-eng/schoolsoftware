/**
 * Core design-system components. Every screen composes from these —
 * no screen defines its own StyleSheet.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, elevation, motion, radius, space, type } from "./tokens";

/** Every valid Material Icons glyph name. Exported so screens can type icon maps. */
export type IconName = React.ComponentProps<typeof MaterialIcons>["name"];

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
  fg = color.onPrimary,
  icon,
  block = false
}: {
  label: string;
  onPress?: () => void;
  bg?: string;
  fg?: string;
  icon?: IconName;
  /** Stretch to fill the parent instead of hugging the label. */
  block?: boolean;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      style={[styles.pillButton, block && styles.pillButtonBlock, { backgroundColor: bg }]}
    >
      {icon ? <Icon name={icon} size={17} tint={fg} /> : null}
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

/* ---------------------------------------------------------------- Screen header */
/** The greeting block at the top of every workspace home screen. */
export function ScreenHeader({
  eyebrow,
  title,
  trailing
}: {
  eyebrow?: string;
  title: string;
  trailing?: React.ReactNode;
}) {
  return (
    <View style={styles.screenHeader}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {eyebrow ? (
          <DSText variant="label" tint={color.ink3} style={{ fontWeight: "500" }}>
            {eyebrow}
          </DSText>
        ) : null}
        <DSText variant="display" numberOfLines={1}>{title}</DSText>
      </View>
      {trailing}
    </View>
  );
}

/** Large page title used on non-home tabs ("Tasks", "Academics"). */
export function PageTitle({ children }: { children: React.ReactNode }) {
  return <DSText variant="display" style={styles.pageTitle}>{children}</DSText>;
}

/* ---------------------------------------------------------------- Hero */
/**
 * The filled primary banner (check-in prompt, collections total).
 * `tone` picks the container: primary for prompts, success for confirmations.
 */
export function Hero({
  tone = "primary",
  children,
  style
}: {
  tone?: "primary" | "success" | "warning";
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const bg =
    tone === "success" ? color.successContainer
      : tone === "warning" ? color.warningSurface
        : color.primaryGradientA;
  return (
    <View style={[styles.hero, { backgroundColor: bg }, tone === "primary" && elevation.hero, style]}>
      {children}
    </View>
  );
}

/* ---------------------------------------------------------------- Stat tile */
export function StatTile({
  value,
  label,
  tint
}: {
  value: string | number;
  label: string;
  tint?: string;
}) {
  return (
    <Card style={styles.statTile}>
      <DSText variant="display" tint={tint} style={styles.statValue} numberOfLines={1}>
        {value}
      </DSText>
      <DSText variant="label" style={styles.statLabel} numberOfLines={2}>{label}</DSText>
    </Card>
  );
}

/* ---------------------------------------------------------------- Chips */
export function FilterChips({
  options,
  value,
  onChange
}: {
  options: string[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option)}
            style={({ pressed }) => [
              styles.chip,
              active && styles.chipActive,
              pressed && { transform: [{ scale: motion.pressScale }] }
            ]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------------------------------------------------------------- Progress */
export function ProgressBar({
  percent,
  tint = color.primary
}: {
  percent: number;
  tint?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  // Template literals widen to `string`, which RN's DimensionValue rejects.
  const width: DimensionValue = `${clamped}%`;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      style={styles.progressTrack}
    >
      <View style={[styles.progressFill, { width, backgroundColor: tint }]} />
    </View>
  );
}

/** Labelled progress row — "Class 9 — Linear equations · 58%". */
export function ProgressRow({
  label,
  percent,
  valueLabel,
  tint
}: {
  label: string;
  percent: number;
  valueLabel?: string;
  tint?: string;
}) {
  return (
    <View style={{ gap: space.xs + 2 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <DSText variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>{label}</DSText>
        <DSText variant="label">{valueLabel ?? `${Math.round(percent)}%`}</DSText>
      </View>
      <ProgressBar percent={percent} tint={tint} />
    </View>
  );
}

/* ---------------------------------------------------------------- Bottom sheet */
export function BottomSheet({
  visible,
  title,
  onClose,
  children,
  primaryLabel,
  onPrimary
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children?: React.ReactNode;
  primaryLabel?: string;
  onPrimary?: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetScrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <View style={styles.sheetGrabber} />
        <View style={styles.sheetHeader}>
          <DSText variant="title" style={{ flex: 1 }}>{title}</DSText>
          <PressableScale onPress={onClose} accessibilityLabel="Close">
            <Icon name="close" size={22} tint={color.ink3} />
          </PressableScale>
        </View>
        {children}
        {primaryLabel ? (
          <View style={{ marginTop: space.md }}>
            <PillButton label={primaryLabel} onPress={onPrimary ?? onClose} />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

/* ------------------------------------------------------ Full-screen panel */
/**
 * Full-screen drill-in surface used by the supplied role designs for chat,
 * attendance marking, task verification and bus EMI details.
 */
export function FullScreenPanel({
  visible,
  title,
  subtitle,
  onClose,
  children,
  footer
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.panel}>
        <View style={[styles.panelHeader, { paddingTop: insets.top + 6 }]}>
          <PressableScale onPress={onClose} accessibilityLabel="Back" style={styles.panelBack}>
            <Icon name="arrow-back" size={22} tint={color.ink} />
          </PressableScale>
          <View style={{ flex: 1, minWidth: 0 }}>
            <DSText variant="title" numberOfLines={1}>{title}</DSText>
            {subtitle ? <DSText variant="caption" numberOfLines={1}>{subtitle}</DSText> : null}
          </View>
        </View>
        <View style={styles.panelBody}>{children}</View>
        {footer ? (
          <View style={[styles.panelFooter, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            {footer}
          </View>
        ) : null}
      </View>
    </Modal>
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
  pillButton: {
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm
  },
  pillButtonBlock: { alignSelf: "stretch" },
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
  toastText: { color: color.onPrimary, fontSize: 13.5, flex: 1 },

  screenHeader: { flexDirection: "row", alignItems: "center", gap: space.md, paddingTop: space.sm },
  pageTitle: { paddingTop: space.sm },

  hero: {
    borderRadius: radius.xl,
    padding: space.lg,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },

  statTile: {
    flex: 1,
    padding: space.md,
    paddingHorizontal: space.sm,
    alignItems: "center",
    borderRadius: radius.md
  },
  statValue: { fontSize: 17 },
  statLabel: { fontSize: 11, marginTop: 2, textAlign: "center" },

  chipRow: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: space.lg + 4,
    paddingVertical: space.sm + 2,
    borderWidth: 1,
    borderColor: color.outlineStrong,
    backgroundColor: color.surface
  },
  chipActive: { backgroundColor: color.primaryContainer, borderColor: color.primaryContainer },
  chipText: { fontSize: 13, fontWeight: "600", color: color.ink2 },
  chipTextActive: { color: color.onPrimaryContainer },

  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceVariant,
    overflow: "hidden"
  },
  progressFill: { height: 6, borderRadius: radius.pill },

  sheetScrim: { flex: 1, backgroundColor: "rgba(26,27,34,0.45)" },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: space.xl,
    paddingBottom: space.xxl,
    gap: space.md
  },
  sheetGrabber: {
    alignSelf: "center",
    width: 34,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: color.outlineStrong
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: space.md },

  panel: { flex: 1, backgroundColor: color.background },
  panelHeader: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: space.md,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: color.outline
  },
  panelBack: {
    width: 40,
    height: 40,
    borderRadius: radius.circle,
    alignItems: "center",
    justifyContent: "center"
  },
  panelBody: { flex: 1 },
  panelFooter: {
    backgroundColor: color.background,
    borderTopWidth: 1,
    borderTopColor: color.outline,
    paddingHorizontal: space.xl,
    paddingTop: space.md
  }
});
