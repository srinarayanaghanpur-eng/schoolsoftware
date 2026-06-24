import { type ReactNode, useEffect, useRef } from "react";
import { Animated, Easing, type StyleProp, type ViewStyle } from "react-native";

export function AnimatedEntrance({
  children,
  delay = 0,
  style
}: {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 460,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    });
    animation.start();
    return () => animation.stop();
  }, [delay, progress]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }]
        }
      ]}
    >
      {children}
    </Animated.View>
  );
}
