/**
 * Admin Notices — school circulars, newest first.
 */
import React from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import {
  DSText, EmptyState, ErrorState, Icon, ListRow, SkeletonPage, PageTitle,
  SectionCard, TonalTile
} from "@/design-system/components";
import { space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
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
  const { t } = useTheme();
  const { notices, loading, error, refresh } = useNotices();

  const tiles = [
    { bg: t.tint, tint: t.blue },
    { bg: t.tint, tint: t.blue },
    { bg: t.warnBg, tint: t.warn },
    { bg: t.okBg, tint: t.ok }
  ];

  if (loading && notices.length === 0) return <SkeletonPage />;
  if (error && notices.length === 0) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={t.blue} />}
    >
      <PageTitle>Notices</PageTitle>

      <SectionCard heading={`${notices.length} PUBLISHED`}>
        {notices.length === 0 ? (
          <EmptyState icon="campaign" label="No notices published yet." />
        ) : (
          notices.map((notice, index) => {
            const tile = tiles[index % tiles.length];
            return (
              <View key={notice.id}>
                {index > 0 ? <View style={[styles.divider, { backgroundColor: t.line }]} /> : null}
                <ListRow
                  leading={
                    <TonalTile bg={tile.bg}>
                      <Icon name="campaign" size={19} tint={tile.tint} />
                    </TonalTile>
                  }
                  title={notice.title ?? "Untitled notice"}
                  subtitle={`${notice.audience ?? "All"} · ${formatDate(notice.createdAt)}`}
                />
              </View>
            );
          })
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
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, paddingTop: space.md, gap: 14 },
  divider: { height: StyleSheet.hairlineWidth }
});
