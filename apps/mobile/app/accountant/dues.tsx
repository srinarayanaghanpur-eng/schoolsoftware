/**
 * Accountant Dues — outstanding fee position.
 */
import React from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import {
  Card, DSText, ErrorState, Icon, ListRow, SkeletonPage, PageTitle,
  PillButton, ProgressRow, SectionCard, TonalTile, useToast
} from "@/design-system/components";
import { radius, space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
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
  const { t } = useTheme();
  const toast = useToast();
  const { stats, loading, error, refresh } = useDashboardStats();

  if (loading && !stats) return <SkeletonPage />;
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
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={t.blue} />}
    >
      <PageTitle>Dues</PageTitle>

      <View style={styles.statRow}>
        <Card style={styles.moneyCard}>
          <TonalTile bg={t.badBg} size={36}>
            <Icon name="schedule" size={19} tint={t.bad} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {formatMoneyShort(outstanding)}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>DUE</DSText>
        </Card>
        <Card style={styles.moneyCard}>
          <TonalTile bg={t.warnBg} size={36}>
            <Icon name="group" size={19} tint={t.warn} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {stats?.studentsWithOutstandingFees ?? 0}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>STUDENTS</DSText>
        </Card>
        <Card style={styles.moneyCard}>
          <TonalTile bg={t.tint} size={36}>
            <Icon name="functions" size={19} tint={t.blue} />
          </TonalTile>
          <DSText variant="display" style={styles.moneyValue} numberOfLines={1}>
            {formatMoneyShort(averageDue)}
          </DSText>
          <DSText variant="overline" style={styles.moneyLabel} numberOfLines={1}>AVG DUE</DSText>
        </Card>
      </View>

      <PillButton
        label="Send payment reminders"
        block
        bg={t.blue}
        fg="#FFFFFF"
        onPress={() => toast.show("Student-by-student defaulter lists and reminder campaigns are in the web dashboard.")}
      />

      <Card style={{ gap: space.md }}>
        <DSText variant="overline">COLLECTION PROGRESS</DSText>
        <ProgressRow
          label="Against total demand"
          percent={collectionRate}
          valueLabel={`${Math.round(collectionRate)}%`}
          tint={collectionRate >= 75 ? t.ok : t.warn}
        />
        <DSText variant="label">
          {formatMoney(collected)} collected of {formatMoney(total)}
        </DSText>
      </Card>

      <SectionCard heading="BREAKDOWN">
        <ListRow
          leading={<TonalTile bg={t.okBg}><Icon name="check-circle" size={19} tint={t.ok} /></TonalTile>}
          title={formatMoney(collected)}
          subtitle="Collected to date"
        />
        <View style={[styles.divider, { backgroundColor: t.line }]} />
        <ListRow
          leading={<TonalTile bg={t.badBg}><Icon name="schedule" size={19} tint={t.bad} /></TonalTile>}
          title={formatMoney(outstanding)}
          subtitle={`${stats?.studentsWithOutstandingFees ?? 0} students still owe`}
        />
        <View style={[styles.divider, { backgroundColor: t.line }]} />
        <ListRow
          leading={<TonalTile bg={t.tint}><Icon name="functions" size={19} tint={t.blue} /></TonalTile>}
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
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, paddingTop: space.md, gap: 14 },
  statRow: { flexDirection: "row", gap: 10 },
  moneyCard: {
    flex: 1,
    padding: space.md,
    paddingHorizontal: space.sm,
    alignItems: "flex-start",
    gap: 6,
    borderRadius: radius.lg
  },
  moneyValue: { fontSize: 17, fontWeight: "800" },
  moneyLabel: { fontSize: 10 },
  divider: { height: StyleSheet.hairlineWidth }
});
