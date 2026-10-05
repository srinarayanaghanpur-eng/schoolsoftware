/**
 * Parent Home — implements the Home tab of the approved Parent App design,
 * wired to live /api/portal/summary data.
 */
import React from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Avatar, Badge, Card, DSText, ErrorState, Icon, ListRow, LoadingState,
  PillButton, PressableScale, ScreenHeader, SectionCard, TonalTile, useToast
} from "@/design-system/components";
import { radius, space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import { useMobileSession } from "@/lib/mobileSession";
import { ParentShell } from "@/features/parent/shell";
import { ChildSwitcher } from "@/features/parent/ChildSwitcher";
import { useSelectChild, useSelectedChildId, useSelectedChildRaw } from "@/features/parent/SelectedChild";
import { formatDue, formatMoney, greeting, initials, subjectCode, useParentHomework, useParentSummary } from "@/features/parent/hooks";
import type { Palette } from "@/lib/Theme";

function tileFor(code: string, t: Palette): { bg: string; fg: string } {
  if (code === "MATH") return { bg: t.tint, fg: t.blue };
  if (code === "SCI") return { bg: t.okBg, fg: t.ok };
  if (code === "ENG") return { bg: t.warnBg, fg: t.warn };
  if (code === "HIN") return { bg: t.badBg, fg: t.bad };
  return { bg: t.tint, fg: t.blue };
}

export default function ParentHomeRoute() {
  return (
    <ParentShell>
      <ParentHome />
    </ParentShell>
  );
}

function ParentHome() {
  const { t } = useTheme();
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
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={t.blue} />}
    >
      {/* greeting header — Welcome small + name h1 */}
      <ScreenHeader eyebrow={`Welcome · ${greeting()}`} title={parentName} />

      <ChildSwitcher children={linkedStudents} selectedId={activeId} onSelect={select} />

      {/* child identity card */}
      <Card style={styles.childCard}>
        <Avatar label={initials(student.name)} size={50} bg={t.tint} fg={t.blue} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.childName, { color: t.ink }]} numberOfLines={1}>{student.name}</Text>
          <Text style={[styles.childMeta, { color: t.mute }]} numberOfLines={1}>
            Class {student.className}{student.section ? student.section : ""} · Adm {student.admissionNo}
          </Text>
          <View style={styles.chipRow}>
            <Badge label={`Class ${student.className}${student.section ? student.section : ""}`} bg={t.tint} fg={t.blue} />
          </View>
        </View>
      </Card>

      {/* fees due hero — blue gradient + white Pay now */}
      {fees.due > 0 ? (
        <LinearGradient
          colors={[t.heroFrom, t.heroMid, t.heroTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroCircle} pointerEvents="none" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <DSText variant="caption" tint="rgba(255,255,255,0.8)">FEES DUE</DSText>
            <DSText variant="display" tint="#FFFFFF" style={styles.heroMoney} numberOfLines={1}>
              {formatMoney(fees.due)}
            </DSText>
            <DSText variant="label" tint="rgba(255,255,255,0.8)">Pay at the school office or web portal</DSText>
          </View>
          <PillButton
            label="Pay now"
            bg="#FFFFFF"
            fg={t.blue}
            onPress={() => toast.show("Please pay at the school office or web portal.")}
          />
        </LinearGradient>
      ) : null}

      {/* services 4-tile grid */}
      <View>
        <DSText variant="overline" style={styles.servicesLabel}>SERVICES</DSText>
        <View style={styles.servicesGrid}>
          <PressableScale
            accessibilityLabel="Receipts"
            onPress={() => router.push("/parent/fees" as never)}
            style={[styles.serviceTile, { backgroundColor: t.card, borderColor: t.line }]}
          >
            <TonalTile bg={t.tint} size={38}>
              <Icon name="receipt-long" size={20} tint={t.blue} />
            </TonalTile>
            <DSText variant="caption" tint={t.mute} style={styles.serviceLabel}>Receipts</DSText>
          </PressableScale>
          <PressableScale
            accessibilityLabel="Report card"
            onPress={() => toast.show("Report cards are available in the web portal.")}
            style={[styles.serviceTile, { backgroundColor: t.card, borderColor: t.line }]}
          >
            <TonalTile bg={t.okBg} size={38}>
              <Icon name="description" size={20} tint={t.ok} />
            </TonalTile>
            <DSText variant="caption" tint={t.mute} style={styles.serviceLabel}>Report card</DSText>
          </PressableScale>
          <PressableScale
            accessibilityLabel="Timetable"
            onPress={() => toast.show("Timetables are available in the web portal.")}
            style={[styles.serviceTile, { backgroundColor: t.card, borderColor: t.line }]}
          >
            <TonalTile bg={t.warnBg} size={38}>
              <Icon name="calendar-month" size={20} tint={t.warn} />
            </TonalTile>
            <DSText variant="caption" tint={t.mute} style={styles.serviceLabel}>Timetable</DSText>
          </PressableScale>
          <PressableScale
            accessibilityLabel="Message"
            onPress={() => router.push("/parent/messages" as never)}
            style={[styles.serviceTile, { backgroundColor: t.card, borderColor: t.line }]}
          >
            <TonalTile bg={t.badBg} size={38}>
              <Icon name="chat-bubble" size={20} tint={t.bad} />
            </TonalTile>
            <DSText variant="caption" tint={t.mute} style={styles.serviceLabel}>Message</DSText>
          </PressableScale>
        </View>
      </View>

      {/* recent receipts — latest few, full history lives on Fees */}
      {summary.recentPayments.length > 0 ? (
        <SectionCard heading="RECENT RECEIPTS">
          {summary.recentPayments.slice(0, 3).map((payment, index) => (
            <View key={payment.id}>
              {index > 0 ? <View style={[styles.divider, { backgroundColor: t.line }]} /> : null}
              <ListRow
                leading={
                  <TonalTile bg={t.okBg} size={36}>
                    <Icon name="receipt" size={18} tint={t.ok} />
                  </TonalTile>
                }
                title={`${formatMoney(payment.amountPaid)} · ${payment.paymentMethod || "—"}`}
                subtitle={`${(payment.createdAt || "").slice(0, 10)}${payment.receiptNumber ? ` · Receipt ${payment.receiptNumber}` : ""}`}
              />
            </View>
          ))}
          <PressableScale
            accessibilityLabel="View all receipts"
            onPress={() => router.push("/parent/fees" as never)}
            style={styles.viewAll}
          >
            <DSText variant="bodyMedium" tint={t.blue}>View all</DSText>
            <Icon name="chevron-right" size={18} tint={t.blue} />
          </PressableScale>
        </SectionCard>
      ) : null}

      {/* homework today */}
      <SectionCard
        heading="HOMEWORK"
        trailing={dueHomework.length > 0 ? <Badge label={`${dueHomework.length} due`} bg={t.warnBg} fg={t.warn} /> : undefined}
      >
        {dueHomework.length === 0 ? (
          <DSText variant="label">No homework due — all caught up.</DSText>
        ) : (
          dueHomework.map((hw, index) => {
            const code = subjectCode(hw.subject);
            const tile = tileFor(code, t);
            return (
              <View key={hw.id}>
                {index > 0 ? <View style={[styles.divider, { backgroundColor: t.line }]} /> : null}
                <ListRow
                  leading={<TonalTile bg={tile.bg}><Text style={{ fontSize: 11, fontWeight: "700", color: tile.fg }}>{code}</Text></TonalTile>}
                  title={hw.title}
                  subtitle={`${hw.subject} · ${formatDue(hw.dueDate).label}`}
                  chevron
                  onPress={() => router.push("/parent/homework" as never)}
                />
              </View>
            );
          })
        )}
      </SectionCard>

      {/* latest notice card */}
      <SectionCard heading="SCHOOL NOTICES">
        {notices.length === 0 ? (
          <DSText variant="label">No notices right now.</DSText>
        ) : (
          notices.slice(0, 3).map((notice, index) => (
            <View key={index} style={[styles.noticeCard, { backgroundColor: t.bg, borderColor: t.line }]}>
              <View style={styles.noticeTop}>
                <DSText variant="bodyMedium" style={{ flex: 1 }} numberOfLines={2}>{notice.title}</DSText>
                {notice.createdAt ? (
                  <Badge label={notice.createdAt.slice(0, 10)} bg={t.tint} fg={t.blue} />
                ) : null}
              </View>
              <DSText variant="label" numberOfLines={3}>{notice.body}</DSText>
            </View>
          ))
        )}
      </SectionCard>

      {/* message teacher CTA */}
      <PressableScale
        accessibilityLabel="Message the school"
        onPress={() => router.push("/parent/messages" as never)}
        style={[styles.messageCta, { backgroundColor: t.blue }]}
      >
        <Icon name="chat" size={18} tint="#FFFFFF" />
        <DSText variant="bodyMedium" tint="#FFFFFF">Message the school</DSText>
      </PressableScale>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, paddingTop: space.md, gap: 14 },
  childCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: radius.xl,
    paddingHorizontal: 18
  },
  childName: { fontSize: 16, fontWeight: "700" },
  childMeta: { fontSize: 12.5, marginTop: 2 },
  chipRow: { flexDirection: "row", marginTop: 6 },
  hero: {
    borderRadius: radius.xl,
    padding: space.lg,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    overflow: "hidden"
  },
  heroCircle: {
    position: "absolute",
    top: -70,
    right: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.1)"
  },
  heroMoney: { fontSize: 26, fontWeight: "800" },
  servicesLabel: { marginBottom: space.sm },
  servicesGrid: { flexDirection: "row", gap: 10 },
  serviceTile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: space.md + 2,
    paddingHorizontal: space.xs,
    alignItems: "center",
    gap: space.sm
  },
  serviceLabel: { fontWeight: "500", textAlign: "center" },
  divider: { height: StyleSheet.hairlineWidth },
  noticeCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 6
  },
  noticeTop: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  viewAll: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: space.sm
  },
  messageCta: {
    borderRadius: radius.pill,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm
  }
});
