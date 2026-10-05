/**
 * Parent Profile tab — live summary data: parent identity, linked children,
 * fee receipts (recent payments), menu, logout.
 */
import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Avatar, Badge, DSText, EmptyState, ErrorState, Icon, ListRow, LoadingState,
  PillButton, SectionCard, TonalTile, useToast
} from "@/design-system/components";
import { color, elevation, radius, space } from "@/design-system/tokens";
import { useMobileSession } from "@/lib/mobileSession";
import { formatMoney, initials, useParentSummary } from "@/features/parent/hooks";
import { fetchPushPreferences, updatePushPreferences, type PushPrefs } from "@/features/parent/api";
import { ChildSwitcher } from "@/features/parent/ChildSwitcher";
import { useSelectChild, useSelectedChildId, useSelectedChildRaw } from "@/features/parent/SelectedChild";
import { ParentShell } from "@/features/parent/shell";

export default function ParentProfileRoute() {
  return (
    <ParentShell>
      <ParentProfileScreen />
    </ParentShell>
  );
}

const PREF_ROWS: Array<{ key: keyof PushPrefs; title: string; subtitle: string }> = [
  { key: "fees", title: "Fee reminders", subtitle: "Due dates and receipts" },
  { key: "attendance", title: "Attendance", subtitle: "Absence alerts for your child" },
  { key: "homework", title: "Homework", subtitle: "New homework assigned" },
  { key: "notices", title: "Notices", subtitle: "School announcements" },
  { key: "exams", title: "Exam results", subtitle: "Published results" }
];

const CHILD_TILES: Array<{ bg: string; fg: string }> = [
  { bg: color.tileLavender, fg: color.primaryDeep },
  { bg: color.tileSky, fg: color.primaryDeep },
  { bg: color.tileMint, fg: color.success },
  { bg: color.tilePeach, fg: color.onWarningDeep },
  { bg: color.tileRose, fg: color.error },
  { bg: color.tileLemon, fg: color.onWarningDeep }
];

function ParentProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const session = useMobileSession();
  const rawChoice = useSelectedChildRaw();
  const { summary, linkedStudents, loading, error, refresh } = useParentSummary(rawChoice);
  const activeId = useSelectedChildId(linkedStudents);
  const select = useSelectChild();

  const parentName = session.profile?.displayName ?? "Parent";

  const [prefs, setPrefs] = useState<PushPrefs | null>(null);
  const [prefsFailed, setPrefsFailed] = useState(false);

  const loadPrefs = useCallback(async () => {
    try {
      const { prefs: fresh } = await fetchPushPreferences();
      setPrefs(fresh);
      setPrefsFailed(false);
    } catch {
      setPrefsFailed(true);
    }
  }, []);

  useEffect(() => {
    void loadPrefs();
  }, [loadPrefs]);

  const togglePref = useCallback(async (key: keyof PushPrefs) => {
    if (!prefs) return;
    const previous = prefs;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try {
      await updatePushPreferences({ [key]: next[key] });
    } catch {
      setPrefs(previous);
      toast.show("Couldn't save that setting. Please try again.");
    }
  }, [prefs, toast]);

  const logout = async () => {
    try {
      await session.logout();
      router.replace("/login" as never);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Logout failed. Please try again.");
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.sm }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={color.primary} />}
    >
      {/* delivery-app identity header */}
      <View style={[styles.identityRow, elevation.card]}>
        <Avatar label={initials(parentName)} size={56} bg={color.primary} fg={color.onPrimary} />
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <DSText variant="title" style={styles.identityName} numberOfLines={1}>{parentName}</DSText>
          {summary?.student ? (
            <View style={styles.chipRow}>
              <Badge
                label={`Class ${summary.student.className ?? "—"}${summary.student.section ?? ""}`}
                bg={color.tileLavender}
                fg={color.primaryDeep}
              />
            </View>
          ) : null}
          {summary?.student ? (
            <DSText variant="label" numberOfLines={1}>
              Parent of {summary.student.name ?? "—"}
            </DSText>
          ) : null}
          <DSText variant="label" numberOfLines={1}>{session.profile?.email ?? session.profile?.employeeId ?? ""}</DSText>
        </View>
      </View>

      {loading && !summary ? <LoadingState /> : null}
      {error && !summary ? <ErrorState message={error} onRetry={refresh} /> : null}

      <ChildSwitcher children={linkedStudents} selectedId={activeId} onSelect={select} />

      {/* children */}
      {linkedStudents.length > 1 ? (
        <SectionCard heading="MY CHILDREN">
          {linkedStudents.map((child, index) => {
            const tile = CHILD_TILES[index % CHILD_TILES.length] ?? { bg: color.tileSky, fg: color.primaryDeep };
            return (
              <ListRow
                key={child.id}
                leading={<Avatar label={initials(child.name)} size={36} bg={tile.bg} fg={tile.fg} />}
                title={child.name}
                subtitle={`Class ${child.className}${child.section} · Adm ${child.admissionNo}`}
              />
            );
          })}
        </SectionCard>
      ) : null}

      {/* fee receipts */}
      {summary ? (
        <SectionCard heading="FEE RECEIPTS">
          {(summary.recentPayments ?? []).length === 0 ? (
            <EmptyState icon="receipt" label="No payments recorded yet." />
          ) : (
            (summary.recentPayments ?? []).map((payment) => (
              <ListRow
                key={payment.id}
                leading={
                  <TonalTile bg={color.tileMint} size={36}>
                    <Icon name="check" size={18} tint={color.success} />
                  </TonalTile>
                }
                title={`${formatMoney(payment.amountPaid)} · ${payment.paymentMethod || "—"}`}
                subtitle={`Paid ${payment.createdAt}${payment.receiptNumber ? ` · Receipt ${payment.receiptNumber}` : ""}`}
              />
            ))
          )}
          {(summary.fees?.due ?? 0) > 0 ? (
            <ListRow
              leading={
                <TonalTile bg={color.tilePeach} size={36}>
                  <Icon name="schedule" size={18} tint={color.onWarningDeep} />
                </TonalTile>
              }
              title={`${formatMoney(summary.fees.due)} outstanding`}
              subtitle="Pay at the school office or web portal"
            />
          ) : null}
        </SectionCard>
      ) : null}

      {/* message settings */}
      {prefs ? (
        <SectionCard heading="MESSAGE SETTINGS">
          {PREF_ROWS.map((row) => (
            <ListRow
              key={row.key}
              title={row.title}
              subtitle={row.subtitle}
              trailing={
                <Switch
                  value={prefs[row.key]}
                  onValueChange={() => void togglePref(row.key)}
                  trackColor={{ false: color.outline, true: color.primary }}
                />
              }
            />
          ))}
        </SectionCard>
      ) : prefsFailed ? (
        <SectionCard heading="MESSAGE SETTINGS">
          <ListRow
            title="Couldn't load message settings"
            subtitle="Tap to retry"
            chevron
            onPress={() => void loadPrefs()}
          />
        </SectionCard>
      ) : null}

      {/* menu */}
      <SectionCard heading="MORE">
        <ListRow
          leading={
            <TonalTile bg={color.tileLavender} size={36}>
              <Icon name="description" size={19} tint={color.primary} />
            </TonalTile>
          }
          title="Documents & receipts"
          subtitle="Available in the web portal"
          chevron
          onPress={() => toast.show("Open the web portal for downloads.")}
        />
        <ListRow
          leading={
            <TonalTile bg={color.tileSky} size={36}>
              <Icon name="help-outline" size={19} tint={color.primary} />
            </TonalTile>
          }
          title="Help & support"
          chevron
          onPress={() => toast.show("Contact the school office for help.")}
        />
      </SectionCard>

      <PillButton label="Logout from this device" bg={color.error} onPress={logout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingTop: 10,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.outline,
    borderRadius: radius.xl,
    padding: space.lg
  },
  identityName: { fontSize: 19, fontWeight: "700" },
  chipRow: { flexDirection: "row" }
});
