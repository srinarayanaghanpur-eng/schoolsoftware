/**
 * Parent Profile tab — live summary data: parent identity, linked children,
 * fee receipts (recent payments), menu, logout.
 */
import React from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Avatar, DSText, ErrorState, Icon, ListRow, LoadingState,
  PillButton, SectionCard, TonalTile, useToast
} from "@/design-system/components";
import { color, space } from "@/design-system/tokens";
import { useMobileSession } from "@/lib/mobileSession";
import { formatMoney, initials, useParentSummary } from "@/features/parent/hooks";
import { ParentShell } from "@/features/parent/shell";

export default function ParentProfileRoute() {
  return (
    <ParentShell>
      <ParentProfileScreen />
    </ParentShell>
  );
}

function ParentProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const session = useMobileSession();
  const { summary, linkedStudents, loading, error, refresh } = useParentSummary();

  const parentName = session.profile?.displayName ?? "Parent";

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
      {/* identity */}
      <View style={styles.identityRow}>
        <Avatar label={initials(parentName)} size={64} bg={color.success} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <DSText variant="title" style={{ fontSize: 19 }}>{parentName}</DSText>
          {summary ? (
            <DSText variant="label">
              Parent of {summary.student.name} · Class {summary.student.className}{summary.student.section}
            </DSText>
          ) : null}
          <DSText variant="label">{session.profile?.email ?? session.profile?.employeeId ?? ""}</DSText>
        </View>
      </View>

      {loading && !summary ? <LoadingState /> : null}
      {error && !summary ? <ErrorState message={error} onRetry={refresh} /> : null}

      {/* children */}
      {linkedStudents.length > 1 ? (
        <SectionCard heading="MY CHILDREN">
          {linkedStudents.map((child) => (
            <ListRow
              key={child.id}
              leading={<Avatar label={initials(child.name)} size={36} bg={color.primary} />}
              title={child.name}
              subtitle={`Class ${child.className}${child.section} · Adm ${child.admissionNo}`}
            />
          ))}
        </SectionCard>
      ) : null}

      {/* fee receipts */}
      {summary ? (
        <SectionCard heading="FEE RECEIPTS">
          {summary.recentPayments.length === 0 ? (
            <DSText variant="label">No payments recorded yet.</DSText>
          ) : (
            summary.recentPayments.map((payment) => (
              <ListRow
                key={payment.id}
                leading={
                  <TonalTile bg={color.successContainer} size={36}>
                    <Icon name="check" size={18} tint={color.success} />
                  </TonalTile>
                }
                title={`${formatMoney(payment.amountPaid)} · ${payment.paymentMethod || "—"}`}
                subtitle={`Paid ${payment.createdAt}${payment.receiptNumber ? ` · Receipt ${payment.receiptNumber}` : ""}`}
              />
            ))
          )}
          {summary.fees.due > 0 ? (
            <ListRow
              leading={
                <TonalTile bg={color.warningContainer} size={36}>
                  <Icon name="schedule" size={18} tint={color.warning} />
                </TonalTile>
              }
              title={`${formatMoney(summary.fees.due)} outstanding`}
              subtitle="Pay at the school office or web portal"
            />
          ) : null}
        </SectionCard>
      ) : null}

      {/* menu */}
      <SectionCard heading="MORE">
        <ListRow
          leading={<Icon name="description" size={21} tint={color.primary} />}
          title="Documents & receipts"
          subtitle="Available in the web portal"
          chevron
          onPress={() => toast.show("Open the web portal for downloads.")}
        />
        <ListRow
          leading={<Icon name="help-outline" size={21} tint={color.primary} />}
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
  identityRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 10 }
});
