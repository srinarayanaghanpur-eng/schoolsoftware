/**
 * Parent Messages tab.
 *
 * The design shows an inbox + chat thread. The backend currently exposes only
 * POST /api/portal/messages (parent → school); there is no inbox GET yet.
 * So this screen lists school notices as the read side, and implements the
 * compose flow (subject/body → POST) as a full-screen sheet matching the
 * design's thread overlay. Swap in a real inbox endpoint when it exists.
 */
import React, { useState } from "react";
import {
  Animated, Easing, KeyboardAvoidingView, Platform, RefreshControl,
  ScrollView, StyleSheet, TextInput, View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Avatar, DSText, EmptyState, ErrorState, Icon, ListRow, LoadingState,
  PressableScale, TonalTile, useToast
} from "@/design-system/components";
import { color, motion, radius, space } from "@/design-system/tokens";
import { sendParentMessage } from "@/features/parent/api";
import { useParentSummary } from "@/features/parent/hooks";
import { ParentShell } from "@/features/parent/shell";

export default function ParentMessagesRoute() {
  return (
    <ParentShell>
      <ParentMessagesScreen />
    </ParentShell>
  );
}

function ParentMessagesScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { summary, loading, error, refresh } = useParentSummary();
  const [composeOpen, setComposeOpen] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sheetAnim] = useState(() => new Animated.Value(0));

  const openCompose = () => {
    setComposeOpen(true);
    sheetAnim.setValue(0);
    Animated.timing(sheetAnim, {
      toValue: 1,
      duration: motion.sheetDuration,
      easing: Easing.bezier(0.2, 0.8, 0.3, 1),
      useNativeDriver: true
    }).start();
  };

  const send = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      await sendParentMessage({
        studentId: summary?.student.id,
        type: "general",
        subject: `Message from parent of ${summary?.student.name ?? "student"}`,
        body: body.trim()
      });
      setBody("");
      setComposeOpen(false);
      toast.show("Message sent to the school ✓");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Unable to send message.");
    } finally {
      setSending(false);
    }
  };

  const notices = summary?.notices ?? [];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[styles.page, { paddingTop: insets.top + space.sm }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={color.primary} />}
      >
        <DSText variant="display" style={{ paddingHorizontal: space.xl, paddingTop: 6, paddingBottom: space.md }}>
          Messages
        </DSText>

        {loading && !summary ? <LoadingState /> : null}
        {error && !summary ? <ErrorState message={error} onRetry={refresh} /> : null}
        {!loading && notices.length === 0 && summary ? (
          <EmptyState icon="chat-bubble-outline" label="No school messages yet." />
        ) : null}

        {notices.map((notice, index) => (
          <View key={index} style={styles.inboxRow}>
            <ListRow
              leading={<Avatar label="SA" size={44} bg={color.accountPurple} />}
              title={notice.title}
              subtitle={notice.body}
            />
          </View>
        ))}
      </ScrollView>

      {/* compose FAB */}
      <PressableScale accessibilityLabel="Message the school" onPress={openCompose} style={[styles.fab, { bottom: 20 + insets.bottom }]}>
        <Icon name="edit" size={22} tint={color.onPrimary} />
      </PressableScale>

      {/* compose sheet (mirrors the design's thread overlay) */}
      {composeOpen ? (
        <Animated.View
          style={[styles.sheet, {
            opacity: sheetAnim,
            transform: [{ translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }]
          }]}
        >
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <View style={[styles.sheetHeader, { paddingTop: insets.top + 6 }]}>
              <PressableScale accessibilityLabel="Close" onPress={() => setComposeOpen(false)} style={styles.backButton}>
                <Icon name="arrow-back" size={22} tint={color.ink} />
              </PressableScale>
              <TonalTile bg={color.primaryContainer} size={36}>
                <Icon name="school" size={18} tint={color.primary} />
              </TonalTile>
              <View>
                <DSText variant="title" style={{ fontSize: 15 }}>School office</DSText>
                <DSText variant="caption">Replies within a working day</DSText>
              </View>
            </View>
            <View style={{ flex: 1, padding: space.xl }}>
              <DSText variant="label" style={{ marginBottom: space.sm }}>
                Your message goes to the school office and your child's class teacher.
              </DSText>
              <TextInput
                style={styles.input}
                multiline
                placeholder="Type your message…"
                placeholderTextColor={color.muted}
                value={body}
                onChangeText={setBody}
              />
            </View>
            <View style={[styles.sendRow, { paddingBottom: 14 + insets.bottom }]}>
              <View style={styles.sendHint}>
                <DSText variant="label" numberOfLines={1}>
                  {summary ? `About ${summary.student.name} · Class ${summary.student.className}` : "General enquiry"}
                </DSText>
              </View>
              <PressableScale accessibilityLabel="Send message" onPress={send} style={[styles.sendButton, sending && { opacity: 0.6 }]}>
                <Icon name="send" size={20} tint={color.onPrimary} />
              </PressableScale>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 100 },
  inboxRow: { paddingHorizontal: space.xl, paddingVertical: space.md },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: color.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: color.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6
  },
  sheet: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.background, zIndex: 30 },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: space.md,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: color.outline
  },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  input: {
    flex: 1,
    backgroundColor: color.surfaceVariant,
    borderRadius: radius.lg,
    padding: space.lg,
    fontSize: 14,
    color: color.ink,
    textAlignVertical: "top"
  },
  sendRow: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, paddingTop: 10 },
  sendHint: {
    flex: 1,
    backgroundColor: color.surfaceVariant,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 13
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: color.primary,
    alignItems: "center",
    justifyContent: "center"
  }
});
