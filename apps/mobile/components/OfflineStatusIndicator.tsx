import { useBackgroundSyncStatus } from "@/lib/hooks/usePerformance";
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

export function OfflineStatusIndicator() {
  const { syncStatus } = useBackgroundSyncStatus();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const isSyncing = syncStatus === "syncing";
  const show = isSyncing;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: show ? 1 : 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [show, fadeAnim]);

  useEffect(() => {
    if (!isSyncing) return;
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true
      })
    );
    loop.start();
    return () => loop.stop();
  }, [isSyncing, spinAnim]);

  if (!show) return null;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.spinner,
            {
              transform: [
                {
                  rotate: spinAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", "360deg"]
                  })
                }
              ]
            }
          ]}
        />
        <View>
          <Text style={styles.boldText}>Syncing data...</Text>
          <Text style={styles.subText}>Your data is being updated</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 80,
    left: 12,
    right: 12,
    backgroundColor: "#3033a1",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#1b1d32",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 6
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  spinner: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.25)",
    borderTopColor: "#ffffff"
  },
  boldText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800"
  },
  subText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "600"
  }
});
