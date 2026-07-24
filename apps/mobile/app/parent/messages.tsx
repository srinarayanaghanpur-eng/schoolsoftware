/**
 * Parent Messages — inbox and class-teacher thread from Parent App.dc.html.
 * The outgoing message uses the real portal API; inbox samples can be replaced
 * by the pending GET endpoint without changing the presentation.
 */
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Avatar, DSText, FullScreenPanel, Icon, PressableScale, UnreadDot, useToast
} from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { sendParentMessage } from "@/features/parent/api";
import { useParentSummary } from "@/features/parent/hooks";
import { ParentShell } from "@/features/parent/shell";

const INBOX = [
  {
    id: "teacher",
    initials: "PS",
    bg: color.primary,
    from: "Ms. Sharma · Class teacher",
    preview: "Rohan did very well in the Unit 4 test — 92/100.",
    time: "3:05 PM",
    unread: 1
  },
  {
    id: "accounts",
    initials: "AO",
    bg: color.ink2,
    from: "Accounts Office",
    preview: "Term 2 fee reminder — due 31 Jul.",
    time: "11:20 AM",
    unread: 1
  },
  {
    id: "announcements",
    initials: "SA",
    bg: color.accountPurple,
    from: "School Announcements",
    preview: "PTM for classes 8 & 9 — Saturday 9 AM.",
    time: "Yesterday",
    unread: 0
  },
  {
    id: "transport",
    initials: "TR",
    bg: color.success,
    from: "Transport Desk",
    preview: "Bus route 7 will start 10 minutes earlier from Monday.",
    time: "Yesterday",
    unread: 0
  }
];

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
  const { summary } = useParentSummary();
  const [threadOpen, setThreadOpen] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      await sendParentMessage({
        studentId: summary?.student.id,
        type: "general",
        subject: `Message to class teacher from parent of ${summary?.student.name ?? "student"}`,
        body: body.trim()
      });
      setBody("");
      toast.show("Message sent to Ms. Sharma ✓");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Unable to send message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[styles.page, { paddingTop: insets.top + space.sm }]}
        showsVerticalScrollIndicator={false}
      >
        <DSText variant="display" style={styles.title}>Messages</DSText>
        {INBOX.map((message) => (
          <PressableScale
            key={message.id}
            accessibilityLabel={`Open ${message.from}`}
            onPress={() => {
              if (message.id === "teacher") setThreadOpen(true);
              else toast.show(`Opening ${message.from.split(" ·")[0]}…`);
            }}
            style={styles.inboxRow}
          >
            <Avatar label={message.initials} size={44} bg={message.bg} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.nameRow}>
                <DSText
                  variant="bodyMedium"
                  style={{ flex: 1, fontWeight: message.unread > 0 ? "700" : "500" }}
                  numberOfLines={1}
                >
                  {message.from}
                </DSText>
                <DSText variant="caption">{message.time}</DSText>
              </View>
              <DSText variant="body" tint={color.ink2} numberOfLines={1}>
                {message.preview}
              </DSText>
            </View>
            <UnreadDot count={message.unread} />
          </PressableScale>
        ))}
      </ScrollView>

      <FullScreenPanel
        visible={threadOpen}
        title="Ms. Sharma"
        subtitle="Class teacher · 8A · replies within a day"
        onClose={() => setThreadOpen(false)}
        footer={
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.composer}>
              <TextInput
                style={styles.input}
                placeholder="Message"
                placeholderTextColor={color.muted}
                value={body}
                onChangeText={setBody}
                returnKeyType="send"
                onSubmitEditing={() => { void send(); }}
              />
              <PressableScale
                accessibilityLabel="Send message"
                onPress={() => { void send(); }}
                style={[styles.sendButton, sending && { opacity: 0.6 }]}
              >
                <Icon name="send" size={20} tint={color.onPrimary} />
              </PressableScale>
            </View>
          </KeyboardAvoidingView>
        }
      >
        <ScrollView contentContainerStyle={styles.thread} showsVerticalScrollIndicator={false}>
          <DSText variant="caption" style={styles.dayChip}>Today</DSText>
          <View style={styles.incomingBubble}>
            <DSText variant="body">
              Rohan did very well in the Unit 4 test — 92/100. Keep encouraging the daily practice.
            </DSText>
          </View>
          <View style={styles.outgoingBubble}>
            <DSText variant="body" tint={color.onPrimary}>
              Thank you so much, ma&apos;am! He was nervous about mensuration.
            </DSText>
          </View>
          <View style={styles.delivery}>
            <DSText variant="caption">3:12 PM</DSText>
            <Icon name="done-all" size={14} tint={color.primary} />
          </View>
        </ScrollView>
      </FullScreenPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: space.xl },
  title: { paddingHorizontal: space.xl, paddingTop: 6, paddingBottom: space.md },
  inboxRow: {
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md
  },
  nameRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  thread: { padding: space.xl, gap: 10 },
  dayChip: {
    alignSelf: "center",
    backgroundColor: color.surfaceVariant,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill
  },
  incomingBubble: {
    alignSelf: "flex-start",
    maxWidth: "78%",
    backgroundColor: color.surfaceVariant,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    padding: 14
  },
  outgoingBubble: {
    alignSelf: "flex-end",
    maxWidth: "78%",
    backgroundColor: color.primary,
    borderRadius: 18,
    borderBottomRightRadius: 6,
    padding: 14
  },
  delivery: {
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    gap: 3
  },
  composer: { flexDirection: "row", alignItems: "center", gap: space.sm },
  input: {
    flex: 1,
    backgroundColor: color.surfaceVariant,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 13,
    fontSize: 14,
    color: color.ink
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: radius.circle,
    backgroundColor: color.primary,
    alignItems: "center",
    justifyContent: "center"
  }
});
