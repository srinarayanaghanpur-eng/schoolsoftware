/**
 * Teacher Inbox — school notices and announcements.
 *
 * Notices are read from the holiday/announcement data the teacher hook already
 * subscribes to. A staff-messaging endpoint does not exist yet (Phase 2
 * backlog); the compose affordance is therefore omitted rather than faked.
 */
import React, { useMemo } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Avatar, DSText, EmptyState, ErrorState, Icon, ListRow, LoadingState, PageTitle,
  SectionCard, TonalTile
} from "@/design-system/components";
import { color, space } from "@/design-system/tokens";
import { useTeacherAttendanceData } from "@/lib/useTeacherAttendanceData";
import { TeacherShell } from "@/features/teacher/shell";

export default function TeacherInboxRoute() {
  return (
    <TeacherShell>
      <TeacherInbox />
    </TeacherShell>
  );
}

function TeacherInbox() {
  const insets = useSafeAreaInsets();
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
      <PageTitle>Inbox</PageTitle>

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
        Staff-to-staff messaging arrives in the next release.
      </DSText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 }
});
