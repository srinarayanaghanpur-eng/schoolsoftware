/**
 * Admin Notices — school circulars, newest first.
 */
import React from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import {
  DSText, EmptyState, ErrorState, Icon, ListRow, SkeletonPage, PageTitle,
  TonalTile
} from "@/design-system/components";
import { space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import { AdminShell } from "@/features/admin/shell";
import { formatDate, useNotices } from "@/features/admin/hooks";

export default function AdminNoticesRoute() {
  return (
    <AdminShell>
      <NoticesScreen />
    </AdminShell>
  );
}

/** Shared read-only circulars list — reused by principal + accountant routes. */
export function NoticesScreen() {
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

  // Virtualized: circulars accumulate over terms and must not all mount.
  return (
    <FlatList
      data={notices}
      keyExtractor={(notice) => notice.id}
      renderItem={({ item: notice, index }) => {
        const tile = tiles[index % tiles.length];
        return (
          <ListRow
            leading={
              <TonalTile bg={tile.bg}>
                <Icon name="campaign" size={19} tint={tile.tint} />
              </TonalTile>
            }
            title={notice.title ?? "Untitled notice"}
            subtitle={`${notice.audience ?? "All"} · ${formatDate(notice.createdAt)}`}
          />
        );
      }}
      ItemSeparatorComponent={() => <View style={[styles.divider, { backgroundColor: t.line }]} />}
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={t.blue} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <PageTitle>Notices</PageTitle>
          <DSText variant="overline">{`${notices.length} PUBLISHED`}</DSText>
        </View>
      }
      ListEmptyComponent={
        <EmptyState icon="campaign" label="No notices published yet." />
      }
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={7}
      removeClippedSubviews={true}
    />
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, paddingTop: space.md, gap: 14 },
  header: { gap: 14 },
  divider: { height: StyleSheet.hairlineWidth }
});
