/**
 * Accountant Dues — outstanding fee position.
 */
import React from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Card, DSText, ErrorState, Icon, ListRow, LoadingState, PageTitle,
  ProgressRow, SectionCard, StatTile, TonalTile
} from "@/design-system/components";
import { color, space } from "@/design-system/tokens";
import { AccountantShell } from "@/features/admin/shell";
import { formatMoney, formatMoneyShort, useDashboardStats } from "@/features/admin/hooks";

export default function AccountantDuesRoute() {
  return (
    <AccountantShell>
      <AccountantDues />
    </AccountantShell>
  );
}

function AccountantDues() {
  const insets = useSafeAreaInsets();
  const { stats, loading, error, refresh } = useDashboardStats();

  if (loading && !stats) return <LoadingState label="Loading dues…" />;
  if (error && !stats) return <ErrorState message={error} onRetry={refresh} />;

  const total = stats?.totalFeeAmount ?? 0;
  const collected = stats?.totalFeeCollected ?? 0;
  const outstanding = stats?.totalFeeOutstanding ?? 0;
  const collectionRate = total > 0 ? (collected / total) * 100 : 0;
  const averageDue =
    stats && stats.studentsWithOutstandingFees > 0
      ? outstanding / stats.studentsWithOutstandingFees
      : 0;

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xs }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={color.primary} />}
    >
      <PageTitle>Dues</PageTitle>

      <View style={styles.statRow}>
        <StatTile value={formatMoneyShort(outstanding)} label="Outstanding" tint={color.error} />
        <StatTile value={stats?.studentsWithOutstandingFees ?? 0} label="Students" tint={color.warning} />
        <StatTile value={formatMoneyShort(averageDue)} label="Average due" tint={color.primary} />
      </View>

      <Card style={{ gap: space.md }}>
        <DSText variant="overline">COLLECTION PROGRESS</DSText>
        <ProgressRow
          label="Against total demand"
          percent={collectionRate}
          valueLabel={`${Math.round(collectionRate)}%`}
          tint={collectionRate >= 75 ? color.success : color.warning}
        />
        <DSText variant="label">
          {formatMoney(collected)} collected of {formatMoney(total)}
        </DSText>
      </Card>

      <SectionCard heading="BREAKDOWN">
        <ListRow
          leading={<TonalTile bg={color.successContainer}><Icon name="check-circle" size={19} tint={color.success} /></TonalTile>}
          title={formatMoney(collected)}
          subtitle="Collected to date"
        />
        <ListRow
          leading={<TonalTile bg={color.errorContainer}><Icon name="schedule" size={19} tint={color.error} /></TonalTile>}
          title={formatMoney(outstanding)}
          subtitle={`${stats?.studentsWithOutstandingFees ?? 0} students still owe`}
        />
        <ListRow
          leading={<TonalTile bg={color.surfaceVariant}><Icon name="functions" size={19} tint={color.ink2} /></TonalTile>}
          title={formatMoney(total)}
          subtitle="Total demand this year"
        />
      </SectionCard>

      <DSText variant="caption" style={{ textAlign: "center" }}>
        Student-by-student defaulter lists and reminder campaigns are in the
        web dashboard.
      </DSText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 },
  statRow: { flexDirection: "row", gap: 10 }
});
