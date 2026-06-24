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
            <View>
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
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  date: { fontWeight: "800", color: "#17211b" },
  muted: { marginTop: 4, color: "#66736a" }
});
