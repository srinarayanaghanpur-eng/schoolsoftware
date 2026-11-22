/**
 * Rapido-style swipe control. Built with the platform Animated API and
 * PanResponder so the driver demo stays lightweight (no Reanimated bundle).
 */
import React, { useEffect, useRef, useState } from "react";
import { Animated, PanResponder, View, type LayoutChangeEvent } from "react-native";
import { DSText, Icon } from "@/design-system/components";
import { radius, space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";

export function SwipeToStart({
  label,
  onComplete,
  disabled = false,
  tone = "primary",
  hint
}: {
  label: string;
  onComplete: () => void;
  disabled?: boolean;
  tone?: "primary" | "danger";
  hint?: string;
}) {
  const { t } = useTheme();
  const accent = tone === "danger" ? t.bad : t.blue;
  const [width, setWidth] = useState(0);
  const pan = useRef(new Animated.Value(0)).current;
  const maxRef = useRef(0);
  const disabledRef = useRef(disabled);
  const onCompleteRef = useRef(onComplete);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    disabledRef.current = disabled;
    if (disabled) Animated.spring(pan, { toValue: 0, useNativeDriver: true }).start();
  }, [disabled, pan]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  const max = Math.max(0, width - 64);
  maxRef.current = max;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder: (_event, gesture) =>
        !disabledRef.current && Math.abs(gesture.dx) > 4,
      onPanResponderMove: (_event, gesture) => {
        const next = Math.max(0, Math.min(maxRef.current, gesture.dx));
        pan.setValue(next);
      },
      onPanResponderRelease: (_event, gesture) => {
        if (maxRef.current > 0 && gesture.dx >= maxRef.current * 0.72) {
          Animated.timing(pan, {
            toValue: maxRef.current,
            duration: 140,
            useNativeDriver: true
          }).start();
          onCompleteRef.current();
          resetTimer.current = setTimeout(() => {
            Animated.spring(pan, { toValue: 0, useNativeDriver: true }).start();
          }, 700);
        } else {
          Animated.spring(pan, { toValue: 0, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(pan, { toValue: 0, useNativeDriver: true }).start();
      }
    })
  ).current;

  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  const fillWidth = pan.interpolate({
    inputRange: [0, Math.max(1, max)],
    outputRange: [64, Math.max(64, max + 64)],
    extrapolate: "clamp"
  });

  const labelOpacity = pan.interpolate({
    inputRange: [0, Math.max(1, max * 0.45)],
    outputRange: [1, 0],
    extrapolate: "clamp"
  });

  return (
    <View
      onLayout={onLayout}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${label}. Swipe right to continue.`}
      style={{
        height: 64,
        borderRadius: radius.pill,
        backgroundColor: disabled ? t.line : t.tint,
        borderWidth: 1,
        borderColor: t.line,
        justifyContent: "center",
        overflow: "hidden"
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: fillWidth,
          backgroundColor: disabled ? t.faint : accent,
          borderRadius: radius.pill
        }}
      />
      <Animated.View
        pointerEvents="none"
        style={{
          opacity: labelOpacity,
          paddingLeft: 72,
          paddingRight: space.lg
        }}
      >
        <DSText
          variant="bodyMedium"
          tint={disabled ? t.mute : accent}
          numberOfLines={1}
          style={{ fontWeight: "700" }}
        >
          {label}
        </DSText>
        <DSText variant="caption" tint={disabled ? t.faint : t.mute} numberOfLines={1}>
          {hint ?? "Swipe the arrow to continue"}
        </DSText>
      </Animated.View>
      <Animated.View
        {...responder.panHandlers}
        style={{
          position: "absolute",
          left: 4,
          top: 4,
          width: 56,
          height: 56,
          borderRadius: radius.circle,
          backgroundColor: disabled ? t.faint : accent,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ translateX: pan }],
          shadowColor: accent,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: disabled ? 0 : 0.24,
          shadowRadius: 12,
          elevation: disabled ? 0 : 5
        }}
      >
        <Icon name="arrow-forward" size={25} tint={t.card} />
      </Animated.View>
    </View>
  );
}
