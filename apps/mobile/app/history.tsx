import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { StatusPill } from "@/components/StatusPill";
import { useTeacherAttendanceData } from "@/lib/useTeacherAttendanceData";
import type { AttendanceStatus } from "@sri-narayana/shared";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

const FILTERS: { label: string; value: AttendanceStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Present", value: "present" },
  { label: "Late", value: "late" },
  { label: "Absent", value: "absent" },
  { label: "CL", value: "cl" }
];

function pad(v: number) {
  return String(v).padStart(2, "0");
}

function formatMonth(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export default function History() {
  const { records, loading, error } = useTeacherAttendanceData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | "all">("all");

  const filtered = useMemo(() => {
    let result = [...records];
    if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((r) => r.date.includes(q) || r.source.toLowerCase().includes(q));
    }
    result.sort((a, b) => b.date.localeCompare(a.date));
    return result;
  }, [records, statusFilter, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const record of filtered) {
      const month = record.date.slice(0, 7);
      if (!map.has(month)) map.set(month, []);
      map.get(month)!.push(record);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <Screen title="History" subtitle="Search and review your attendance records">
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by date or source..."
          placeholderTextColor="#9aa3bd"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          allowFontScaling={false}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.value}
            style={({ pressed }) => [
              styles.filterChip,
              statusFilter === f.value && styles.filterChipActive,
              pressed && styles.pressed
            ]}
            onPress={() => setStatusFilter(f.value)}
          >
            <Text style={[styles.filterChipText, statusFilter === f.value && styles.filterChipTextActive]} allowFontScaling={false}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <Card>
          <Text style={styles.emptyTitle} allowFontScaling={false}>Loading records...</Text>
          <Text style={styles.emptySub} allowFontScaling={false}>Your attendance history is syncing.</Text>
        </Card>
      ) : error ? (
        <Card>
          <Text style={styles.errorText} allowFontScaling={false}>{error}</Text>
        </Card>
      ) : grouped.length === 0 ? (
        <Card>
          <Text style={styles.emptyTitle} allowFontScaling={false}>No records found</Text>
          <Text style={styles.emptySub} allowFontScaling={false}>Try adjusting your search or filter.</Text>
        </Card>
      ) : (
        grouped.map(([month, records]) => (
          <View key={month}>
            <Text style={styles.monthLabel} allowFontScaling={false}>{formatMonth(month)}</Text>
            {records.map((record) => (
              <Card key={`${record.teacherId}_${record.date}`}>
                <View style={styles.row}>
                  <View style={styles.copy}>
                    <Text style={styles.date} allowFontScaling={false}>{record.date}</Text>
                    <Text style={styles.muted} allowFontScaling={false}>
                      {record.source}
                      {record.lateMinutes > 0 ? ` · ${record.lateMinutes} min late` : ""}
                    </Text>
                  </View>
                  <StatusPill status={record.status} />
                </View>
              </Card>
            ))}
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchRow: { marginBottom: 4 },
  searchInput: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#dfe3f2",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#1b1d32",
    fontSize: 14,
    fontWeight: "700"
  },
  filterRow: { flexDirection: "row", marginBottom: 4, flexGrow: 0 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#dfe3f2",
    marginRight: 8
  },
  filterChipActive: { backgroundColor: "#3033a1", borderColor: "#3033a1" },
  filterChipText: { color: "#5c6687", fontSize: 12, fontWeight: "800" },
  filterChipTextActive: { color: "white" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  monthLabel: {
    color: "#7d86a8",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 4
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  copy: { flex: 1 },
  date: { fontWeight: "900", color: "#1b1d32", fontSize: 15 },
  muted: { marginTop: 5, color: "#7d86a8", fontSize: 13, fontWeight: "700" },
  errorText: { color: "#c9435e", fontSize: 13, lineHeight: 19, fontWeight: "700", textAlign: "center" },
  emptyTitle: { color: "#1b1d32", fontSize: 16, fontWeight: "900", textAlign: "center" },
  emptySub: { marginTop: 6, color: "#7d86a8", fontSize: 13, fontWeight: "600", textAlign: "center" }
});
