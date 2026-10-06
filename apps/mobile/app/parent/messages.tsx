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
  ScrollView, StyleSheet, View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Avatar, Badge, Card, DSText, EmptyState, ErrorState, Icon,
  PageTitle, PressableScale, SkeletonRows, TextField, TonalTile, useToast
} from "@/design-system/components";
import { motion, radius, space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import { sendParentMessage } from "@/features/parent/api";
import { useParentSummary } from "@/features/parent/hooks";
import { ChildSwitcher } from "@/features/parent/ChildSwitcher";
import { useSelectChild, useSelectedChildId, useSelectedChildRaw } from "@/features/parent/SelectedChild";
import { ParentShell } from "@/features/parent/shell";

export default function ParentMessagesRoute() {
  return (
    <ParentShell>
      <ParentMessagesScreen />
    </ParentShell>
  );
}

function ParentMessagesScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const rawChoice = useSelectedChildRaw();
  const { summary, linkedStudents, loading, error, refresh } = useParentSummary(rawChoice);
  const activeId = useSelectedChildId(linkedStudents);
  const select = useSelectChild();
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
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={t.blue} />}
      >
        <PageTitle>Messages</PageTitle>
        <ChildSwitcher children={linkedStudents} selectedId={activeId} onSelect={select} />

        {loading && !summary ? <SkeletonRows count={3} /> : null}
        {error && !summary ? <ErrorState message={error} onRetry={refresh} /> : null}
        {!loading && notices.length === 0 && summary ? (
          <EmptyState icon="chat-bubble-outline" label="No school messages yet." />
        ) : null}

        {summary && notices.length > 0 ? (
          <DSText variant="overline" style={styles.inboxLabel}>SCHOOL INBOX</DSText>
        ) : null}

        {notices.map((notice, index) => (
          <Card key={index} style={styles.noticeCard}>
            <View style={styles.noticeTop}>
              <Avatar label="SA" size={40} bg={t.tint} fg={t.blue} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <DSText variant="bodyMedium" numberOfLines={2}>{notice.title}</DSText>
                {notice.createdAt ? (
                  <View style={styles.pillRow}>
                    <Badge label={notice.createdAt.slice(0, 10)} bg={t.tint} fg={t.blue} />
                  </View>
                ) : null}
              </View>
            </View>
            <DSText variant="label" style={styles.noticeBody}>{notice.body}</DSText>
          </Card>
        ))}
      </ScrollView>

      {/* compose FAB */}
      <PressableScale accessibilityLabel="Message the school" onPress={openCompose} style={[styles.fab, { backgroundColor: t.blue, bottom: 20 + insets.bottom }]}>
        <Icon name="edit" size={22} tint="#FFFFFF" />
      </PressableScale>

      {/* compose sheet (mirrors the design's thread overlay) */}
      {composeOpen ? (
        <Animated.View
          style={[styles.sheet, { backgroundColor: t.bg }, {
            opacity: sheetAnim,
            transform: [{ translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }]
          }]}
        >
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <View style={[styles.sheetHeader, { borderBottomColor: t.line, paddingTop: insets.top + 6 }]}>
              <PressableScale accessibilityLabel="Close" onPress={() => setComposeOpen(false)} style={styles.backButton}>
                <Icon name="arrow-back" size={22} tint={t.ink} />
              </PressableScale>
              <TonalTile bg={t.tint} size={36}>
                <Icon name="school" size={18} tint={t.blue} />
              </TonalTile>
              <View>
                <DSText variant="title" style={{ fontSize: 15 }}>School office</DSText>
                <DSText variant="caption">Replies within a working day</DSText>
              </View>
            </View>
            <View style={{ flex: 1, padding: space.xl }}>
              <DSText variant="label" style={{ marginBottom: space.sm }}>
                Your message goes to the school office and your child&apos;s class teacher.
              </DSText>
              <TextField
                value={body}
                onChangeText={setBody}
                placeholder="Type your message…"
                multiline
                accessibilityLabel="Message text"
                style={styles.composeBox}
              />
            </View>
            <View style={[styles.sendRow, { paddingBottom: 14 + insets.bottom }]}>
              <View style={[styles.sendHint, { backgroundColor: t.card, borderColor: t.line }]}>
                <DSText variant="label" numberOfLines={1}>
                  {summary ? `About ${summary.student.name} · Class ${summary.student.className}` : "General enquiry"}
                </DSText>
              </View>
              <PressableScale accessibilityLabel="Send message" onPress={send} style={[styles.sendButton, { backgroundColor: t.blue }, sending && { opacity: 0.6 }]}>
                <Icon name="send" size={20} tint="#FFFFFF" />
              </PressableScale>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: 100, paddingTop: space.md, gap: 10 },
  inboxLabel: { marginTop: space.sm },
  noticeCard: { borderRadius: 18, gap: space.sm },
  noticeTop: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  pillRow: { flexDirection: "row", marginTop: 6 },
  noticeBody: { lineHeight: 18 },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6
  },
  sheet: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 30 },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: space.md,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  composeBox: { minHeight: 120 },
  sendRow: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, paddingTop: 10 },
  sendHint: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 13
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center"
  }
});
