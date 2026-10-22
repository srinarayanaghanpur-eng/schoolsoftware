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
type State = { crashed: boolean; message: string; stack: string; route: string };

function currentRoute(): string {
  try {
    if (typeof window !== "undefined" && window.location?.pathname) {
      return window.location.pathname;
    }
  } catch {
    // never let diagnostics break the fallback
  }
  return "native";
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { crashed: false, message: "", stack: "", route: "" };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return {
      crashed: true,
      message: error instanceof Error ? error.message : "Unknown render error",
      route: currentRoute()
    };
  }

  componentDidCatch(_error: unknown, info: { componentStack?: string }): void {
    // Logged to the console only in dev — never ships user data anywhere.
    if (__DEV__) console.warn("[ErrorBoundary] render crash caught");
    // The first component frames name the crashing screen for support.
    // Truncated to 4 frames so no data beyond component names is shown.
    const stack = (info?.componentStack ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 4)
      .join("\n");
    this.setState({ stack });
  }

  private retry = () => {
    this.setState({ crashed: false, message: "", stack: "", route: "" });
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
          {this.state.message ? (
            <DSText variant="caption" style={styles.detail}>
              {this.state.message}
            </DSText>
          ) : null}
          {this.state.route ? (
            <DSText variant="caption" style={styles.detail}>
              Screen: {this.state.route}
            </DSText>
          ) : null}
          {this.state.stack ? (
            <DSText variant="caption" style={styles.detail}>
              {this.state.stack}
            </DSText>
          ) : null}
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
  message: { textAlign: "center" },
  detail: { textAlign: "center", opacity: 0.75 }
});
