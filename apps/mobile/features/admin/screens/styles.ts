import { StyleSheet } from "react-native";
import { radius, space } from "@/design-system/tokens";

export const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, paddingTop: space.md, gap: 14 },
  header: { gap: 14 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 56 },
  sectionTitle: { marginTop: space.sm },
  examPaper: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md
  },
  examActions: { flexDirection: "row", gap: space.sm, marginTop: space.xs },
  examForm: { gap: space.sm, marginTop: space.sm },
  divider: { height: StyleSheet.hairlineWidth },
  statRow: { flexDirection: "row", gap: space.sm },
  moneyGrid: { gap: 10 },
  moneyRow: { flexDirection: "row", gap: 10 },
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
  identityRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 10 },
  moneyPress: { flex: 1 },
  decisionRow: { flexDirection: "row", gap: space.md, marginTop: space.md },
  expenseDetail: {
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.xs
  },
  paperRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  viewAll: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: space.sm
  },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionPress: { flex: 1, minWidth: "46%" },
  actionTile: { gap: 8 },
  actionLabel: { fontWeight: "700" }
});

