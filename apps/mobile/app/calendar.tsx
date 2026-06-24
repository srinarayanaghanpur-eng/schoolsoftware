import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { StatusPill } from "@/components/StatusPill";
import { demoAttendance } from "@sri-narayana/shared";
import { StyleSheet, Text, View } from "react-native";

export default function Calendar() {
  const days = Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, "0"));
  return (
    <Screen title="Calendar" subtitle="May 2026">
      <Card>
        <View style={styles.grid}>
          {days.map((day) => {
            const record = demoAttendance.find((item) => item.date.endsWith(day));
            return (
              <View key={day} style={styles.day}>
                <Text style={styles.dayNumber}>{Number(day)}</Text>
                {record ? (
                  <StatusPill status={record.status} />
                ) : (
                  <Text style={styles.emptyDay}>-</Text>
                )}
              </View>
            );
          })}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" },
  day: { width: "31%", minHeight: 80, borderWidth: 1, borderColor: "#d6d3d1", borderRadius: 10, padding: 10, justifyContent: "space-between", backgroundColor: "#fafbf9" },
  dayNumber: { fontWeight: "800", fontSize: 16, color: "#17211b" },
  emptyDay: { color: "#d6d3d1", fontWeight: "600", fontSize: 12 }
});
