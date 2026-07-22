/**
 * Teacher Inbox — mirrors the Messages tab of Teacher App.dc.html: an urgent
 * banner, staff/office message threads, and school notices.
 *
 * DATA HONESTY: notices are read live from the school calendar. A staff
 * messaging endpoint does not exist yet (Phase 2 backlog), so the urgent banner
 * and MESSAGES list are representative PLACEHOLDER content — marked below.
 */
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Avatar, DSText, EmptyState, ErrorState, Icon, ListRow, LoadingState, PageTitle,
  SectionCard, TonalTile, UnreadDot, useToast
} from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { useTeacherAttendanceData } from "@/lib/useTeacherAttendanceData";
import { TeacherShell } from "@/features/teacher/shell";

/** PLACEHOLDER — sample threads, until a staff-messaging endpoint exists. */
const MESSAGES = [
  { id: "1", initials: "RK", from: "Mrs. Kapoor · Principal", preview: "Please share the Unit 4 marks by 4 PM today.", time: "9:12 AM", unread: 2, bg: color.accountPurple },
  { id: "2", initials: "VP", from: "Vice Principal", preview: "Submit your exam duty preferences by 5 PM.", time: "8:40 AM", unread: 1, bg: color.primary },
  { id: "3", initials: "AK", from: "Arjun Khanna · Science", preview: "Can we swap period 5 tomorrow?", time: "Yesterday", unread: 0, bg: color.success },
  { id: "4", initials: "AO", from: "Accounts Office", preview: "Your payslip for July is ready to download.", time: "Yesterday", unread: 0, bg: color.ink2 }
];

export default function TeacherInboxRoute() {
  return (
    <TeacherShell>
      <TeacherInbox />
    </TeacherShell>
  );
}

function TeacherInbox() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { holidays, loading, error } = useTeacherAttendanceData();

  /** Management-declared holidays are the school's announcements to staff. */
  const announcements = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return holidays
      .filter((h) => h.date >= today && h.type === "management_declared")
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [holidays]);

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return holidays
      .filter((h) => h.date >= today && h.type !== "management_declared")
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
  }, [holidays]);

  if (loading && holidays.length === 0) return <LoadingState label="Loading your inbox…" />;
  if (error && holidays.length === 0) return <ErrorState message={error} />;

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xs }]}
      showsVerticalScrollIndicator={false}
    >
      <PageTitle>Messages</PageTitle>

      {/* urgent banner (placeholder) */}
      <View style={styles.urgent}>
        <Icon name="priority-high" size={20} tint={color.error} />
        <DSText variant="body" tint={color.onErrorContainer} style={{ flex: 1 }}>
          <DSText variant="bodyMedium" tint={color.onErrorContainer}>Urgent: </DSText>
          Submit exam duty preferences by 5 PM today.
        </DSText>
      </View>

      {/* messages (placeholder) */}
      <SectionCard heading="MESSAGES">
        {MESSAGES.map((message) => (
          <ListRow
            key={message.id}
            leading={<Avatar label={message.initials} size={44} bg={message.bg} />}
            title={message.from}
            subtitle={message.preview}
            trailing={
              message.unread > 0
                ? <UnreadDot count={message.unread} />
                : <DSText variant="caption">{message.time}</DSText>
            }
            onPress={() => toast.show("Staff messaging arrives in the next release.")}
          />
        ))}
      </SectionCard>

      <SectionCard heading="FROM THE OFFICE">
        {announcements.length === 0 ? (
          <EmptyState icon="mark-email-read" label="No new announcements. You’re all caught up." />
        ) : (
          announcements.map((item) => (
            <ListRow
              key={`${item.date}-${item.title}`}
              leading={<Avatar label="SO" size={44} bg={color.accountPurple} />}
              title={item.title}
              subtitle={`School office · ${new Date(item.date).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short"
              })}`}
            />
          ))
        )}
      </SectionCard>

      <SectionCard heading="NOTICES & EVENTS">
        {upcoming.length === 0 ? (
          <DSText variant="label">Nothing scheduled right now.</DSText>
        ) : (
          upcoming.map((item) => (
            <ListRow
              key={`${item.date}-${item.title}`}
              leading={
                <TonalTile bg={color.primaryContainer}>
                  <Icon name="campaign" size={19} tint={color.primary} />
                </TonalTile>
              }
              title={item.title}
              subtitle={new Date(item.date).toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long"
              })}
            />
          ))
        )}
      </SectionCard>

      <DSText variant="caption" style={{ textAlign: "center" }}>
        Sample view — live staff messaging arrives in the next release.
      </DSText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 },
  urgent: {
    backgroundColor: color.errorContainer,
    borderRadius: radius.md,
    padding: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm
  }
});
