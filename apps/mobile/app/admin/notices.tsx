/**
 * Admin Notices — school circulars, newest first.
 */
import React from "react";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  DSText, EmptyState, ErrorState, Icon, ListRow, LoadingState, PageTitle,
  SectionCard, TonalTile
} from "@/design-system/components";
import { color, space } from "@/design-system/tokens";
import { AdminShell } from "@/features/admin/shell";
import { formatDate, useNotices } from "@/features/admin/hooks";

export default function AdminNoticesRoute() {
  return (
    <AdminShell>
      <AdminNotices />
    </AdminShell>
  );
}

function AdminNotices() {
  const insets = useSafeAreaInsets();
  const { notices, loading, error, refresh } = useNotices();

  if (loading && notices.length === 0) return <LoadingState label="Loading notices…" />;
  if (error && notices.length === 0) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xs }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={color.primary} />}
    >
      <PageTitle>Notices</PageTitle>

      <SectionCard heading={`${notices.length} PUBLISHED`}>
        {notices.length === 0 ? (
          <EmptyState icon="campaign" label="No notices published yet." />
        ) : (
          notices.map((notice) => (
            <ListRow
              key={notice.id}
              leading={
                <TonalTile bg={color.primaryContainer}>
                  <Icon name="campaign" size={19} tint={color.primary} />
                </TonalTile>
              }
              title={notice.title ?? "Untitled notice"}
              subtitle={`${notice.audience ?? "All"} · ${formatDate(notice.createdAt)}`}
            />
          ))
        )}
      </SectionCard>

      <DSText variant="caption" style={{ textAlign: "center" }}>
        Composing and sending notices is done in the web dashboard, where
        SMS and WhatsApp delivery can be reviewed before sending.
      </DSText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 }
});
