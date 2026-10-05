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
import { ChildSwitcher } from "@/features/parent/ChildSwitcher";
import { useSelectChild, useSelectedChildId, useSelectedChildRaw } from "@/features/parent/SelectedChild";
import { formatDue, formatMoney, greeting, initials, subjectCode, useParentHomework, useParentSummary } from "@/features/parent/hooks";

const SUBJECT_TILES: Record<string, { bg: string; fg: string }> = {
  MATH: { bg: color.tileLavender, fg: color.primaryDeep },
  SCI: { bg: color.tileMint, fg: color.success },
  ENG: { bg: color.tileLemon, fg: color.onWarningDeep },
  HIN: { bg: color.tileRose, fg: color.error }
};

function tileFor(code: string) {
  return SUBJECT_TILES[code] ?? { bg: color.tileSky, fg: color.ink2 };
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
  const rawChoice = useSelectedChildRaw();
  const { summary, linkedStudents, loading, error, refresh } = useParentSummary(rawChoice);
  const activeId = useSelectedChildId(linkedStudents);
  const select = useSelectChild();
  const { homework } = useParentHomework(activeId);

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
      {/* delivery-app identity header */}
      <View style={styles.headerRow}>
        <Avatar label={initials(parentName)} size={46} bg={color.primary} fg={color.onPrimary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <DSText variant="label" tint={color.ink3} style={{ fontWeight: "500" }}>{greeting()}</DSText>
          <DSText variant="title" style={styles.headerName} numberOfLines={1}>{parentName}</DSText>
        </View>
        <Badge label={`Class ${student.className}`} bg={color.tileLavender} fg={color.primaryDeep} />
      </View>

      <ChildSwitcher children={linkedStudents} selectedId={activeId} onSelect={select} />

      {/* child identity card */}
      <View style={[styles.childCard, elevation.card]}>
        <Avatar label={initials(student.name)} size={50} bg={color.tileSky} fg={color.primaryDeep} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.childName} numberOfLines={1}>{student.name}</Text>
          <Text style={styles.childMeta} numberOfLines={1}>
            Class {student.className}{student.section ? student.section : ""} · Adm {student.admissionNo}
          </Text>
          <View style={styles.chipRow}>
            <Badge label={`Class ${student.className}${student.section ? student.section : ""}`} bg={color.tileLavender} fg={color.primaryDeep} />
          </View>
        </View>
      </View>

      {/* fees due banner */}
      {fees.due > 0 ? (
        <View style={[styles.feeBanner, elevation.card]}>
          <TonalTile bg={color.tilePeach}>
            <Icon name="receipt-long" size={20} tint={color.onWarningDeep} />
          </TonalTile>
          <View style={{ flex: 1, minWidth: 0 }}>
            <DSText variant="label" tint={color.ink3}>Fees due</DSText>
            <DSText variant="title" style={styles.feeAmount}>{formatMoney(fees.due)} outstanding</DSText>
          </View>
          <PillButton
            label="Pay now"
            bg={color.primary}
            fg={color.onPrimary}
            onPress={() => toast.show("Please pay at the school office or web portal.")}
          />
        </View>
      ) : null}

      {/* quick summary tiles */}
      <View style={styles.statRow}>
        <Card style={styles.statTile}>
          <TonalTile bg={color.tileMint} size={36}>
            <Icon name="payments" size={18} tint={color.success} />
          </TonalTile>
          <DSText variant="title" style={styles.statValue} numberOfLines={1}>{formatMoney(fees.paid)}</DSText>
          <DSText variant="label" style={styles.statLabel}>Fees paid</DSText>
        </Card>
        <Card style={styles.statTile}>
          <TonalTile bg={color.tileLavender} size={36}>
            <Icon name="school" size={18} tint={color.primary} />
          </TonalTile>
          <DSText variant="title" style={styles.statValue}>{summary.marks.length}</DSText>
          <DSText variant="label" style={styles.statLabel}>Published marks</DSText>
        </Card>
        <Card style={styles.statTile}>
          <TonalTile bg={color.tileSky} size={36}>
            <Icon name="event-available" size={18} tint={color.primaryDeep} />
          </TonalTile>
          <DSText variant="title" style={styles.statValue}>{summary.upcomingHolidays.length}</DSText>
          <DSText variant="label" style={styles.statLabel}>Holidays ahead</DSText>
        </Card>
      </View>

      {/* homework today */}
      <SectionCard
        heading="HOMEWORK"
        trailing={dueHomework.length > 0 ? <Badge label={`${dueHomework.length} due`} bg={color.tileLemon} fg={color.onWarningDeep} /> : undefined}
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
              leading={<TonalTile bg={color.tileSky}><Icon name="campaign" size={19} tint={color.primary} /></TonalTile>}
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
        <Icon name="chat" size={18} tint={color.onPrimary} />
        <DSText variant="bodyMedium" tint={color.onPrimary}>Message the school</DSText>
      </PressableScale>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingTop: space.sm,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.outline,
    borderRadius: radius.xl,
    padding: space.lg
  },
  headerName: { fontSize: 18, fontWeight: "700" },
  childCard: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.outline,
    borderRadius: radius.xl,
    padding: space.lg,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  childName: { fontSize: 16, fontWeight: "700", color: color.ink },
  childMeta: { fontSize: 12.5, color: color.ink3, marginTop: 2 },
  chipRow: { flexDirection: "row", marginTop: 6 },
  feeBanner: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.outline,
    borderRadius: radius.xl,
    padding: 14,
    paddingHorizontal: space.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md
  },
  feeAmount: { fontWeight: "700", fontSize: 15 },
  statRow: { flexDirection: "row", gap: 10 },
  statTile: { flex: 1, padding: space.md, paddingHorizontal: space.sm, alignItems: "center", borderRadius: radius.lg, gap: 4 },
  statValue: { fontSize: 16, fontWeight: "700" },
  statLabel: { fontSize: 11, marginTop: 2, textAlign: "center" },
  messageCta: {
    backgroundColor: color.primary,
    borderRadius: radius.pill,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm
  }
});
