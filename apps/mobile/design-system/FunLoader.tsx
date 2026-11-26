/**
 * FunLoader — bouncy school logo + rotating funny status lines.
 * Uses only React Native Animated, so it works in Expo Go and every module.
 */
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import { useTheme } from "@/lib/Theme";

const MESSAGES = [
  "Waking up the teacher...",
  "Sharpening pencils...",
  "Hiding the homework...",
  "Counting the holidays...",
  "Teaching the bell to ring...",
  "Finding the missing eraser...",
  "Asking the board to behave...",
  "Almost there, no homework yet..."
];

const BOUNCE_HEIGHT = 64;
const LOGO_SIZE = 116;

export default function FunLoader({
  backgroundColor,
  textColor,
  message
}: {
  backgroundColor?: string;
  textColor?: string;
  message?: string;
}) {
  const { t } = useTheme();
  const jump = useRef(new Animated.Value(0)).current;
  const squash = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(1)).current;
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(jump, {
            toValue: 1,
            duration: 450,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true
          }),
          Animated.timing(squash, {
            toValue: -1,
            duration: 150,
            useNativeDriver: true
          })
        ]),
        Animated.timing(jump, {
          toValue: 0,
          duration: 400,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(squash, {
          toValue: 1,
          duration: 90,
          useNativeDriver: true
        }),
        Animated.spring(squash, {
          toValue: 0,
          friction: 3,
          tension: 180,
          useNativeDriver: true
        })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [jump, squash]);

  useEffect(() => {
    if (message) return undefined;
    const timer = setInterval(() => {
      Animated.timing(textOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      }).start(() => {
        setMessageIndex((index) => (index + 1) % MESSAGES.length);
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        }).start();
      });
    }, 2000);
    return () => clearInterval(timer);
  }, [message, textOpacity]);

  const translateY = jump.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -BOUNCE_HEIGHT]
  });
  const scaleY = squash.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [1.12, 1, 0.8]
  });
  const scaleX = squash.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0.92, 1, 1.18]
  });
  const shadowScale = jump.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.5]
  });
  const shadowOpacity = jump.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.1]
  });

  return (
    <View
      style={[styles.container, { backgroundColor: backgroundColor ?? t.bg }]}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading school app"
    >
      <View style={styles.stage}>
        <Animated.Image
          source={require("../assets/LOGO.png")}
          resizeMode="contain"
          style={[styles.logo, { transform: [{ translateY }, { scaleX }, { scaleY }] }]}
        />
        <Animated.View
          style={[
            styles.shadow,
            { opacity: shadowOpacity, transform: [{ scaleX: shadowScale }] }
          ]}
        />
      </View>
      <Animated.Text
        style={[styles.message, { color: textColor ?? t.blue, opacity: textOpacity }]}
      >
        {message ?? MESSAGES[messageIndex]}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  stage: {
    height: LOGO_SIZE + BOUNCE_HEIGHT + 28,
    justifyContent: "flex-end",
    alignItems: "center"
  },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
  shadow: {
    width: LOGO_SIZE * 0.7,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#000",
    marginTop: 8
  },
  message: {
    marginTop: 26,
    minHeight: 44,
    maxWidth: 320,
    fontWeight: "600",
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center"
  }
});
