/**
 * Teacher Inbox — school notices for staff.
 *
 * DATA HONESTY: notices are read live from the school calendar.
 */
import React, { useMemo } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import {
  Avatar, DSText, EmptyState, ErrorState, Icon, ListRow, SkeletonPage, PageTitle,
  SectionCard, TonalTile
} from "@/design-system/components";
import { space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
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
  const { t } = useTheme();
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

  if (loading && holidays.length === 0) return <SkeletonPage />;
  if (error && holidays.length === 0) return <ErrorState message={error} />;

  // Virtualized: announcements grow over the year and must not all mount.
  // The short NOTICES & EVENTS strip (max 5) stays as-is in the footer.
  return (
    <FlatList
      data={announcements}
      keyExtractor={(item) => item.id ?? `${item.date}-${item.title}`}
      renderItem={({ item }) => (
        <ListRow
          leading={<Avatar label="SO" size={44} bg={t.tint} fg={t.blue} />}
          title={item.title}
          subtitle={`School office · ${new Date(item.date).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short"
          })}`}
        />
      )}
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={styles.header}>
          <PageTitle>Messages</PageTitle>
          <DSText variant="overline">FROM THE OFFICE</DSText>
        </View>
      }
      ListEmptyComponent={
        <EmptyState icon="mark-email-read" label="No new announcements. You’re all caught up." />
      }
      ListFooterComponent={
        <SectionCard heading="NOTICES & EVENTS">
          {upcoming.length === 0 ? (
            <DSText variant="label">Nothing scheduled right now.</DSText>
          ) : (
            upcoming.map((item) => (
              <ListRow
                key={`${item.date}-${item.title}`}
                leading={
                  <TonalTile bg={t.tint}>
                    <Icon name="campaign" size={19} tint={t.blue} />
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
      }
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={7}
      removeClippedSubviews={true}
    />
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 },
  header: { gap: 14 }
});
