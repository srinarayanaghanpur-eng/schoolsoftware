import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { db } from "@/lib/firebase";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

type StaffRow = { id: string; fullName: string; employeeId: string; subject: string; status: string };
type FirestoreDocLike = { id: string; data: () => unknown };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export default function People() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getDocs(query(collection(db, "teachers"), limit(100)))
      .then((snapshot) => {
        if (!active) return;
        setStaff(snapshot.docs.map((item: FirestoreDocLike) => {
          const data = asRecord(item.data());
          return {
            id: item.id,
            fullName: String(data.fullName ?? "Teacher"),
            employeeId: String(data.employeeId ?? item.id),
            subject: String(data.subject ?? "General"),
            status: String(data.status ?? "active")
          };
        }).sort((left: StaffRow, right: StaffRow) => left.fullName.localeCompare(right.fullName)));
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return (
    <Screen title="People" subtitle="Teacher directory">
      {loading ? <Card><Text style={styles.helper}>Loading teachers...</Text></Card> : staff.map((teacher) => (
        <Card key={teacher.id}>
          <View style={styles.row}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{teacher.fullName.slice(0, 2).toUpperCase()}</Text></View>
            <View style={styles.copy}>
              <Text style={styles.name}>{teacher.fullName}</Text>
              <Text style={styles.meta}>{teacher.employeeId} | {teacher.subject}</Text>
            </View>
            <Text style={styles.status}>{teacher.status}</Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  helper: { color: "#575e7d", fontSize: 13, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#ecedfb", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#33368f", fontSize: 12, fontWeight: "900" },
  copy: { flex: 1 },
  name: { color: "#181a2c", fontSize: 14, fontWeight: "900" },
  meta: { marginTop: 3, color: "#8a90ac", fontSize: 11, fontWeight: "700" },
  status: { color: "#12915d", fontSize: 11, fontWeight: "900", textTransform: "capitalize" }
});
