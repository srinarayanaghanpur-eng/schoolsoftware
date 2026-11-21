import { StyleSheet } from "react-native";
import { radius, space } from "@/design-system/tokens";

export const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, paddingTop: space.md, gap: 14 },
  header: { gap: 14 },
  back: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start", paddingVertical: 2 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 56 },
  sectionTitle: { marginTop: space.sm },
  divider: { height: StyleSheet.hairlineWidth },
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
  identityRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 6 },
  receiptHero: { gap: space.sm },
  receiptHeroTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  receiptNo: { fontSize: 20 },
  receiptAmountRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  receiptAmount: { fontSize: 24, fontWeight: "800" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  clearSearch: { alignSelf: "flex-start", paddingVertical: 2 },
  dueSectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: space.sm },
  loadMore: { paddingVertical: space.md, alignItems: "center" },
  progressTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4 }
});

