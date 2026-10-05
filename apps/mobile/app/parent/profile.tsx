/**
 * Parent Profile tab — live summary data: parent identity, linked children,
 * fee receipts (recent payments), menu, logout.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Avatar, Badge, DSText, EmptyState, ErrorState, Icon, ListRow, LoadingState,
  PageTitle, PillButton, SectionCard, TonalTile, useToast
} from "@/design-system/components";
import { radius, space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import type { Palette } from "@/lib/Theme";
import { useMobileSession } from "@/lib/mobileSession";
import { formatMoney, initials, useParentSummary } from "@/features/parent/hooks";
import { fetchPushPreferences, updatePushPreferences, type PushPrefs } from "@/features/parent/api";
import { displayLoginContact } from "@/lib/text";
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

function childTile(index: number, t: Palette): { bg: string; fg: string } {
  const tiles = [
    { bg: t.tint, fg: t.blue },
    { bg: t.okBg, fg: t.ok },
    { bg: t.warnBg, fg: t.warn },
    { bg: t.badBg, fg: t.bad }
  ];
  return tiles[index % tiles.length] ?? { bg: t.tint, fg: t.blue };
}

function ParentProfileScreen() {
  const { t } = useTheme();
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

  const confirmLogout = () => {
    Alert.alert("Log out?", "You are getting logged out from this device.", [
      { text: "Stay", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => { void logout(); } }
    ]);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={t.blue} />}
    >
      <PageTitle>Profile</PageTitle>

      {/* greeting header — Welcome small + name h1 */}
      <View style={[styles.identityRow, { backgroundColor: t.card, borderColor: t.line }]}>
        <Avatar label={initials(parentName)} size={56} bg={t.blue} fg="#FFFFFF" />
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <DSText variant="caption" tint={t.mute}>Welcome</DSText>
          <DSText variant="title" style={styles.identityName} numberOfLines={1}>{parentName}</DSText>
          {summary?.student ? (
            <View style={styles.chipRow}>
              <Badge
                label={`Class ${summary.student.className ?? "—"}${summary.student.section ?? ""}`}
                bg={t.tint}
                fg={t.blue}
              />
            </View>
          ) : null}
          {summary?.student ? (
            <DSText variant="label" numberOfLines={1}>
              Parent of {summary.student.name ?? "—"}
            </DSText>
          ) : null}
          <DSText variant="label" numberOfLines={1}>{displayLoginContact(session.profile)}</DSText>
        </View>
      </View>

      {loading && !summary ? <LoadingState /> : null}
      {error && !summary ? <ErrorState message={error} onRetry={refresh} /> : null}

      <ChildSwitcher children={linkedStudents} selectedId={activeId} onSelect={select} />

      {/* children */}
      {linkedStudents.length > 1 ? (
        <SectionCard heading="MY CHILDREN">
          {linkedStudents.map((child, index) => {
            const tile = childTile(index, t);
            return (
              <View key={child.id}>
                {index > 0 ? <View style={[styles.divider, { backgroundColor: t.line }]} /> : null}
                <ListRow
                  leading={<Avatar label={initials(child.name)} size={36} bg={tile.bg} fg={tile.fg} />}
                  title={child.name}
                  subtitle={`Class ${child.className}${child.section} · Adm ${child.admissionNo}`}
                />
              </View>
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
            (summary.recentPayments ?? []).map((payment, index) => (
              <View key={payment.id}>
                {index > 0 ? <View style={[styles.divider, { backgroundColor: t.line }]} /> : null}
                <ListRow
                  leading={
                    <TonalTile bg={t.okBg} size={36}>
                      <Icon name="check" size={18} tint={t.ok} />
                    </TonalTile>
                  }
                  title={`${formatMoney(payment.amountPaid)} · ${payment.paymentMethod || "—"}`}
                  subtitle={`Paid ${payment.createdAt}${payment.receiptNumber ? ` · Receipt ${payment.receiptNumber}` : ""}`}
                />
              </View>
            ))
          )}
          {(summary.fees?.due ?? 0) > 0 ? (
            <View>
              {(summary.recentPayments ?? []).length > 0 ? <View style={[styles.divider, { backgroundColor: t.line }]} /> : null}
              <ListRow
                leading={
                  <TonalTile bg={t.warnBg} size={36}>
                    <Icon name="schedule" size={18} tint={t.warn} />
                  </TonalTile>
                }
                title={`${formatMoney(summary.fees.due)} outstanding`}
                subtitle="Pay at the school office or web portal"
              />
            </View>
          ) : null}
        </SectionCard>
      ) : null}

      {/* message settings */}
      {prefs ? (
        <SectionCard heading="MESSAGE SETTINGS">
          {PREF_ROWS.map((row, index) => (
            <View key={row.key}>
              {index > 0 ? <View style={[styles.divider, { backgroundColor: t.line }]} /> : null}
              <ListRow
                title={row.title}
                subtitle={row.subtitle}
                trailing={
                  <Switch
                    value={prefs[row.key]}
                    onValueChange={() => void togglePref(row.key)}
                    trackColor={{ false: t.line, true: t.blue }}
                  />
                }
              />
            </View>
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
            <TonalTile bg={t.tint} size={36}>
              <Icon name="description" size={19} tint={t.blue} />
            </TonalTile>
          }
          title="Documents & receipts"
          subtitle="Available in the web portal"
          chevron
          onPress={() => toast.show("Open the web portal for downloads.")}
        />
        <View style={[styles.divider, { backgroundColor: t.line }]} />
        <ListRow
          leading={
            <TonalTile bg={t.tint} size={36}>
              <Icon name="help-outline" size={19} tint={t.blue} />
            </TonalTile>
          }
          title="Help & support"
          chevron
          onPress={() => toast.show("Contact the school office for help.")}
        />
      </SectionCard>

      <PillButton label="Logout from this device" bg={t.bad} fg="#FFFFFF" onPress={confirmLogout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, paddingTop: space.md, gap: 14 },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space.lg
  },
  identityName: { fontSize: 19, fontWeight: "700" },
  chipRow: { flexDirection: "row" },
  divider: { height: StyleSheet.hairlineWidth }
});
