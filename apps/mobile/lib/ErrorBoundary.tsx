/**
 * App-level error boundary (premium pass).
 *
 * Any render crash anywhere in the tree lands here instead of the red
 * screen: a calm, branded fallback with what happened and a Retry button
 * that remounts the tree. Uses only context-free primitives so it works
 * even when a provider above it is what crashed.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { Card, DSText, Icon, PillButton } from "@/design-system/components";
import { color, space } from "@/design-system/tokens";

type Props = { children: React.ReactNode };
type State = { crashed: boolean };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError(): State {
    return { crashed: true };
  }

  componentDidCatch(): void {
    // Logged to the console only in dev — never ships user data anywhere.
    if (__DEV__) console.warn("[ErrorBoundary] render crash caught");
  }

  private retry = () => {
    this.setState({ crashed: false });
  };

  render() {
    if (!this.state.crashed) return this.props.children;
    return (
      <View style={styles.root}>
        <Card style={styles.card}>
          <Icon name="error-outline" size={32} tint={color.error} />
          <DSText variant="title" style={styles.title}>Something went wrong</DSText>
          <DSText variant="label" style={styles.message}>
            The screen ran into a problem. Your data is safe — try again.
          </DSText>
          <PillButton label="Try again" onPress={this.retry} block />
        </Card>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xl
  },
  card: { alignItems: "center", gap: space.sm, width: "100%", maxWidth: 360 },
  title: { fontSize: 18 },
  message: { textAlign: "center" }
});
