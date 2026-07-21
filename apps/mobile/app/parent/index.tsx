/**
 * Parent Home — implements the Home tab of the approved Parent App design,
 * wired to live /api/portal/summary data.
 */
import React from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Avatar, Badge, Card, DSText, ErrorState, Icon, ListRow, LoadingState,
  PillButton, PressableScale, SectionCard, TonalTile, useToast
} from "@/design-system/components";
import { color, elevation, radius, space } from "@/design-system/tokens";
import { useMobileSession } from "@/lib/mobileSession";
import { ParentShell } from "@/features/parent/shell";
import { formatDue, formatMoney, greeting, initials, subjectCode, useParentHomework, useParentSummary } from "@/features/parent/hooks";

const SUBJECT_TILES: Record<string, { bg: string; fg: string }> = {
  MATH: { bg: color.primaryContainer, fg: color.onPrimaryContainer },
  SCI: { bg: color.successContainer, fg: color.onSuccessContainer },
  ENG: { bg: color.warningContainer, fg: color.onWarningDeep },
  HIN: { bg: color.errorContainer, fg: color.onErrorContainer }
};

function tileFor(code: string) {
  return SUBJECT_TILES[code] ?? { bg: color.surfaceVariant, fg: color.ink2 };
}

export default function ParentHomeRoute() {
  return (
    <ParentShell>
      <ParentHome />
    </ParentShell>
  );
}

function ParentHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { profile } = useMobileSession();
  const { summary, loading, error, refresh } = useParentSummary();
  const { homework } = useParentHomework(summary?.student.id);

  if (loading && !summary) return <LoadingState label="Opening your family portal…" />;
  if (error && !summary) return <ErrorState message={error} onRetry={refresh} />;
  if (!summary) return <ErrorState message="No student is linked to this account yet. Please contact the school office." />;

  const { student, fees, notices } = summary;
  const dueHomework = homework.filter((hw) => !formatDue(hw.dueDate).overdue).slice(0, 2);
  const parentName = profile?.displayName ?? "Parent";

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xs }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={color.primary} />}
    >
      {/* greeting */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <DSText variant="label" tint={color.ink3} style={{ fontWeight: "500" }}>{greeting()}</DSText>
          <DSText variant="display">{parentName}</DSText>
        </View>
        <Avatar label={initials(parentName)} size={42} bg={color.success} />
      </View>

      {/* child card */}
      <View style={[styles.childCard, elevation.hero]}>
        <Avatar label={initials(student.name)} size={50} bg="rgba(255,255,255,0.18)" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.childName}>{student.name}</Text>
          <Text style={styles.childMeta}>
            Class {student.className}{student.section ? student.section : ""} · Adm {student.admissionNo}
          </Text>
        </View>
      </View>

      {/* fees due banner */}
      {fees.due > 0 ? (
        <View style={styles.feeBanner}>
          <TonalTile bg={color.warningContainer}>
            <Icon name="receipt-long" size={20} tint={color.warning} />
          </TonalTile>
          <View style={{ flex: 1, minWidth: 0 }}>
            <DSText variant="bodyMedium" tint={color.onWarningDeep}>Fees due</DSText>
            <DSText variant="label" tint={color.warning}>{formatMoney(fees.due)} outstanding</DSText>
          </View>
          <PillButton
            label="Pay now"
            bg={color.onWarningDeep}
            onPress={() => toast.show("Please pay at the school office or web portal.")}
          />
        </View>
      ) : null}

      {/* stat tiles */}
      <View style={styles.statRow}>
        <Card style={styles.statTile}>
          <DSText variant="display" tint={color.success} style={styles.statValue}>{formatMoney(fees.paid)}</DSText>
          <DSText variant="label" style={styles.statLabel}>Fees paid</DSText>
        </Card>
        <Card style={styles.statTile}>
          <DSText variant="display" tint={color.primary} style={styles.statValue}>{summary.marks.length}</DSText>
          <DSText variant="label" style={styles.statLabel}>Published marks</DSText>
        </Card>
        <Card style={styles.statTile}>
          <DSText variant="display" style={styles.statValue}>{summary.upcomingHolidays.length}</DSText>
          <DSText variant="label" style={styles.statLabel}>Holidays ahead</DSText>
        </Card>
      </View>

      {/* homework today */}
      <SectionCard
        heading="HOMEWORK"
        trailing={dueHomework.length > 0 ? <Badge label={`${dueHomework.length} due`} /> : undefined}
      >
        {dueHomework.length === 0 ? (
          <DSText variant="label">No homework due — all caught up.</DSText>
        ) : (
          dueHomework.map((hw) => {
            const code = subjectCode(hw.subject);
            const tile = tileFor(code);
            return (
              <ListRow
                key={hw.id}
                leading={<TonalTile bg={tile.bg}><Text style={{ fontSize: 11, fontWeight: "700", color: tile.fg }}>{code}</Text></TonalTile>}
                title={hw.title}
                subtitle={`${hw.subject} · ${formatDue(hw.dueDate).label}`}
                chevron
                onPress={() => router.push("/parent/homework" as never)}
              />
            );
          })
        )}
      </SectionCard>

      {/* notices */}
      <SectionCard heading="SCHOOL NOTICES">
        {notices.length === 0 ? (
          <DSText variant="label">No notices right now.</DSText>
        ) : (
          notices.slice(0, 3).map((notice, index) => (
            <ListRow
              key={index}
              leading={<TonalTile bg={color.primaryContainer}><Icon name="campaign" size={19} tint={color.primary} /></TonalTile>}
              title={notice.title}
              subtitle={notice.body}
            />
          ))
        )}
      </SectionCard>

      {/* message teacher CTA */}
      <PressableScale
        accessibilityLabel="Message the school"
        onPress={() => router.push("/parent/messages" as never)}
        style={styles.messageCta}
      >
        <Icon name="chat" size={18} tint={color.primary} />
        <DSText variant="bodyMedium" tint={color.primary}>Message the school</DSText>
      </PressableScale>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingTop: space.sm },
  childCard: {
    backgroundColor: color.primaryGradientA,
    borderRadius: radius.xl,
    padding: space.lg,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  childName: { fontSize: 16, fontWeight: "600", color: color.onPrimary },
  childMeta: { fontSize: 12.5, color: color.onPrimary, opacity: 0.8, marginTop: 2 },
  feeBanner: {
    backgroundColor: color.warningSurface,
    borderRadius: radius.xl,
    padding: 14,
    paddingHorizontal: space.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md
  },
  statRow: { flexDirection: "row", gap: 10 },
  statTile: { flex: 1, padding: space.md, paddingHorizontal: space.sm, alignItems: "center", borderRadius: radius.md },
  statValue: { fontSize: 17 },
  statLabel: { fontSize: 11, marginTop: 2, textAlign: "center" },
  messageCta: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: color.faint,
    borderRadius: radius.md,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm
  }
});
