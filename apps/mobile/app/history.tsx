import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { StatusPill } from "@/components/StatusPill";
import { demoAttendance } from "@sri-narayana/shared";
import { StyleSheet, Text, View } from "react-native";

export default function History() {
  return (
    <Screen title="Attendance History" subtitle="Recent attendance records">
      {demoAttendance.map((record) => (
        <Card key={`${record.teacherId}_${record.date}`}>
          <View style={styles.row}>
            <View style={styles.copy}>
              <Text style={styles.date}>{record.date}</Text>
              <Text style={styles.muted}>{record.source} · {record.lateMinutes} late minutes</Text>
            </View>
            <StatusPill status={record.status} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  copy: { flex: 1 },
  date: { fontWeight: "900", color: "#1b1d32", fontSize: 15 },
  muted: { marginTop: 5, color: "#7d86a8", fontSize: 13, fontWeight: "700" }
});
