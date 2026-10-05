/**
 * Core design-system components. Every screen composes from these —
 * no screen defines its own StyleSheet.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { elevation, motion, radius, space, type } from "./tokens";
import { fonts, useTheme } from "../lib/Theme";

/** Every valid Material Icons glyph name. Exported so screens can type icon maps. */
export type IconName = React.ComponentProps<typeof MaterialIcons>["name"];

/** Map a type-scale weight to its Plus Jakarta Sans family. */
function fontForWeight(weight: string | number | undefined): string {
  const w = typeof weight === "string" ? parseInt(weight, 10) : weight;
  if (w === 800) return fonts.extraBold;
  if (w === 700) return fonts.bold;
  if (w === 600) return fonts.semiBold;
  if (w === 500) return fonts.medium;
  return fonts.regular;
}

/* ---------------------------------------------------------------- Icon */
export function Icon({ name, size = 21, tint }: { name: IconName; size?: number; tint?: string }) {
  const { t } = useTheme();
  return <MaterialIcons name={name} size={size} color={tint ?? t.ink} />;
}

/* ---------------------------------------------------------------- Text */
export function DSText({
  variant = "body",
  tint,
  style,
  children,
  ...rest
}: React.ComponentProps<typeof Text> & { variant?: keyof typeof type; tint?: string }) {
  const { t } = useTheme();
  const base = type[variant];
  const { color: _omitted, ...scale } = base;
  const weight = (scale as { fontWeight?: string | number }).fontWeight;
  const defaultColor =
    variant === "label" || variant === "caption"
      ? t.mute
      : variant === "overline" || variant === "navLabel"
        ? t.faint
        : t.ink;
  return (
    <Text {...rest} style={[{ ...scale, fontFamily: fontForWeight(weight), color: defaultColor }, tint ? { color: tint } : null, style]}>
      {children}
    </Text>
  );
}

/* ---------------------------------------------------------------- Card */
export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { t } = useTheme();
  return <View style={[styles.card, elevation.card, { backgroundColor: t.card, borderColor: t.line, shadowColor: t.ink }, style]}>{children}</View>;
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
  accessibilityLabel,
  hitSlop
}: {
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** Expand the touch area without changing visuals (min 44px targets). */
  hitSlop?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={hitSlop}
      style={({ pressed }) => [style, pressed && { transform: [{ scale: motion.pressScale }], opacity: 0.92 }]}
    >
      {children}
    </Pressable>
  );
}

export function PillButton({
  label,
  onPress,
  bg,
  fg,
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
  const { t } = useTheme();
  const resolvedBg = bg ?? t.blue;
  const resolvedFg = fg ?? "#FFFFFF";
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      style={[styles.pillButton, block && styles.pillButtonBlock, { backgroundColor: resolvedBg }]}
    >
      {icon ? <Icon name={icon} size={17} tint={resolvedFg} /> : null}
      <Text style={[styles.pillButtonText, { color: resolvedFg }]}>{label}</Text>
    </PressableScale>
  );
}

/* ---------------------------------------------------------------- Avatar */
export function Avatar({
  label,
  size = 44,
  bg,
  fg
}: {
  label: string;
  size?: number;
  bg?: string;
  fg?: string;
}) {
  const { t } = useTheme();
  const resolvedBg = bg ?? t.blue;
  const resolvedFg = fg ?? "#FFFFFF";
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: resolvedBg, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: resolvedFg, fontSize: size * 0.32, fontWeight: "600" }}>{label}</Text>
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
  bg,
  fg
}: {
  label: string;
  bg?: string;
  fg?: string;
}) {
  const { t } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: bg ?? t.warnBg }]}>
      <Text style={[styles.badgeText, { color: fg ?? t.warn }]}>{label}</Text>
    </View>
  );
}

export function UnreadDot({ count }: { count: number }) {
  const { t } = useTheme();
  if (count <= 0) return null;
  return (
    <View style={[styles.unread, { backgroundColor: t.blue }]}>
      <Text style={[styles.unreadText, { color: "#FFFFFF" }]}>{count}</Text>
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
  const { t } = useTheme();
  const body = (
    <View style={styles.listRow}>
      {leading}
      <View style={{ flex: 1, minWidth: 0 }}>
        <DSText variant="bodyMedium" numberOfLines={1}>{title}</DSText>
        {subtitle ? <DSText variant="label" numberOfLines={1} style={{ marginTop: 2 }}>{subtitle}</DSText> : null}
      </View>
      {trailing}
      {chevron ? <Icon name="chevron-right" size={20} tint={t.faint} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && { backgroundColor: t.tint, borderRadius: radius.sm }}>
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
  const { t } = useTheme();
  return (
    <View style={styles.stateWrap}>
      <Icon name={icon} size={28} tint={t.faint} />
      <DSText variant="label" style={{ marginTop: space.sm, textAlign: "center" }}>{label}</DSText>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useTheme();
  return (
    <View style={styles.stateWrap}>
      <Icon name="error-outline" size={28} tint={t.bad} />
      <DSText variant="label" tint={t.bad} style={{ marginTop: space.sm, textAlign: "center" }}>{message}</DSText>
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
  const { t } = useTheme();
  return (
    <View style={styles.screenHeader}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {eyebrow ? (
          <DSText variant="label" tint={t.mute} style={{ fontWeight: "500" }}>
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
  const { t } = useTheme();
  const bg =
    tone === "success" ? t.okBg
      : tone === "warning" ? t.warnBg
        : t.blue;
  return (
    <View style={[styles.hero, { backgroundColor: bg }, tone === "primary" && [elevation.hero, { shadowColor: t.blue }], style]}>
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
  const { t } = useTheme();
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
              { backgroundColor: active ? t.tint : t.card, borderColor: active ? t.tint : t.line },
              pressed && { transform: [{ scale: motion.pressScale }] }
            ]}
          >
            <Text style={[styles.chipText, { color: active ? t.blue : t.ink }]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------------------------------------------------------------- Progress */
export function ProgressBar({
  percent,
  tint
}: {
  percent: number;
  tint?: string;
}) {
  const { t } = useTheme();
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  // Template literals widen to `string`, which RN's DimensionValue rejects.
  const width: DimensionValue = `${clamped}%`;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      style={[styles.progressTrack, { backgroundColor: t.line }]}
    >
      <View style={[styles.progressFill, { width, backgroundColor: tint ?? t.blue }]} />
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
  const { t } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetScrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: t.card }]}>
        <View style={[styles.sheetGrabber, { backgroundColor: t.line }]} />
        <View style={styles.sheetHeader}>
          <DSText variant="title" style={{ flex: 1 }}>{title}</DSText>
          <PressableScale onPress={onClose} accessibilityLabel="Close">
            <Icon name="close" size={22} tint={t.mute} />
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

/* ---------------------------------------------------------------- Toast */
const ToastContext = createContext<{ show: (msg: string) => void }>({ show: () => undefined });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTheme();
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
          style={[styles.toast, elevation.toast, { backgroundColor: t.ink }, {
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }]
          }]}
        >
          <Icon name="check-circle" size={17} tint={t.card} />
          <Text style={[styles.toastText, { color: t.card }]}>{message}</Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/* ---------------------------------------------------------------- styles */
/* ------------------------------------------------------------ TextField */

/**
 * Shared single-line / multiline text field (input-bug fix).
 *
 * The rounded CONTAINER owns every visible pixel (background, border,
 * radius, focus ring). The inner input is deliberately invisible: no
 * border, no outline, transparent background, and flex:1 + minWidth:0 so
 * it can never push past the icon or the container edge. Focus feedback
 * lives on the container via onFocus/onBlur (:focus-within has no
 * React-Native equivalent).
 */
export function TextField({
  value,
  onChangeText,
  placeholder,
  placeholderTextColor,
  secureTextEntry,
  keyboardType,
  returnKeyType,
  onSubmitEditing,
  autoCapitalize = "none",
  autoCorrect = false,
  autoComplete,
  icon,
  trailing,
  accessibilityLabel,
  multiline = false,
  editable = true,
  maxLength,
  inputRef,
  style
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  returnKeyType?: "done" | "go" | "next" | "search" | "send";
  onSubmitEditing?: () => void;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  autoComplete?: "username" | "current-password" | "new-password" | "off";
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  accessibilityLabel?: string;
  multiline?: boolean;
  editable?: boolean;
  maxLength?: number;
  /** Focus control from the parent (e.g. Login ID "next" focuses password). */
  inputRef?: React.Ref<TextInput>;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        styles.fieldContainer,
        { backgroundColor: t.bg, borderColor: focused ? t.blue : t.line },
        focused && Platform.select({
          web: { boxShadow: `0 0 0 3px ${t.blue}33` },
          default: {}
        }),
        multiline && styles.fieldContainerMultiline,
        style
      ]}
    >
      {icon}
      <TextInput
        ref={inputRef}
        style={[styles.fieldInput, { color: t.ink }, multiline && styles.fieldInputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor ?? t.mute}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        autoComplete={autoComplete}
        multiline={multiline}
        editable={editable}
        maxLength={maxLength}
        accessibilityLabel={accessibilityLabel}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {trailing}
    </View>
  );
}

/**
 * Shimmer placeholders for loading lists — calmer and more premium than a
 * spinner. Use inside loading states: <SkeletonRows /> while data loads.
 */
export function Skeleton({
  width,
  height = 14,
  radius: r = radius.md
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
}) {
  const { t } = useTheme();
  const opacity = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 750, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={{ width: width ?? "100%", height, borderRadius: r, backgroundColor: t.line, opacity }}
    />
  );
}

/** Three list-row skeletons (avatar dot + two text lines each). */
export function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <View style={{ gap: space.md }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
          <Skeleton width={40} height={40} radius={radius.circle} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="70%" height={13} radius={6} />
            <Skeleton width="45%" height={11} radius={6} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: 14,
    paddingHorizontal: space.lg
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
    minWidth: 18,
    height: 18,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5
  },
  unreadText: { fontSize: 10.5, fontWeight: "700" },
  listRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: 2 },
  stateWrap: { alignItems: "center", justifyContent: "center", paddingVertical: space.xxl },
  toast: {
    position: "absolute",
    left: space.lg,
    right: space.lg,
    bottom: 24,
    borderRadius: radius.sm,
    paddingHorizontal: space.lg,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    zIndex: 60
  },
  toastText: { fontSize: 13.5, flex: 1 },

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
    borderWidth: 1
  },
  chipText: { fontSize: 13, fontWeight: "600" },

  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    overflow: "hidden"
  },
  progressFill: { height: 6, borderRadius: radius.pill },

  sheetScrim: { flex: 1, backgroundColor: "rgba(26,27,34,0.45)" },
  sheet: {
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
    borderRadius: radius.pill
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: space.md },

  fieldContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14
  },
  fieldContainerMultiline: { alignItems: "flex-start", paddingVertical: space.md },
  fieldInput: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    paddingVertical: 14,
    fontSize: 15,
    backgroundColor: "transparent",
    borderWidth: 0,
    // outlineWidth 0 alone removes the browser focus ring (outlineStyle
    // "none" is web-valid but absent from native types, so it can't be set).
    outlineWidth: 0
  },
  fieldInputMultiline: { paddingVertical: 0, textAlignVertical: "top" }
});
