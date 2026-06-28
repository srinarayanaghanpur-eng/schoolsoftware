import { useEffect, useState } from "react";
import { AnimatedEntrance } from "@/components/AnimatedEntrance";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { StatusPill } from "@/components/StatusPill";
import { auth, db } from "@/lib/firebase";
import { getAttendancePercentage } from "@sri-narayana/shared";
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View, ActivityIndicator } from "react-native";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

interface TeacherData {
  id: string;
  fullName: string;
  employeeId: string;
  subject: string;
}

interface AttendanceRecord {
  teacherId: string;
  date: string;
  status: string;
  checkInTime?: string;
}

export default function Home() {
  const [teacher, setTeacher] = useState<TeacherData | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const user = auth.currentUser;
        if (!user) {
          setError("Please sign in to continue");
          setLoading(false);
          return;
        }

        let teacherData: TeacherData | null = null;
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const teacherId = userData.teacherId || user.uid;
          const teacherDoc = await getDoc(doc(db, "teachers", teacherId));
          if (teacherDoc.exists()) {
            const tData = teacherDoc.data();
            teacherData = {
              id: teacherDoc.id,
              fullName: tData.fullName || "Unknown",
              employeeId: tData.employeeId || "",
              subject: tData.subject || "",
            };
          }
        }

        if (!teacherData) {
          const teachersQuery = query(
            collection(db, "teachers"),
            where("employeeId", "==", user.uid),
            orderBy("fullName")
          );
          try {
            const teachersSnap = await getDocs(teachersQuery);
            if (!teachersSnap.empty) {
              const tDoc = teachersSnap.docs[0];
              const tData = tDoc.data();
              teacherData = {
                id: tDoc.id,
                fullName: tData.fullName || "Unknown",
                employeeId: tData.employeeId || "",
                subject: tData.subject || "",
              };
            }
          } catch {
            // Compound index may not exist; skip fallback
          }
        }

        if (!teacherData) {
          setError("Teacher profile not found");
          setLoading(false);
          return;
        }

        const currentMonth = new Date().toISOString().slice(0, 7);
        const recordsQuery = query(
          collection(db, "attendance"),
          where("teacherId", "==", teacherData.id),
          where("month", "==", currentMonth),
          orderBy("date", "desc")
        );
        const recordsSnap = await getDocs(recordsQuery);
        const attendanceRecords = recordsSnap.docs.map((d) => {
          const data = d.data();
          return {
            teacherId: data.teacherId,
            date: data.date,
            status: data.status,
            checkInTime: data.checkInTime?.toDate?.()?.toISOString() || data.checkInTime,
          } as AttendanceRecord;
        });

        if (!cancelled) {
          setTeacher(teacherData);
          setRecords(attendanceRecords);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load data");
          setLoading(false);
        }
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <Screen title={greeting()} subtitle="Loading your workspace…">
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60 }}>
          <ActivityIndicator size="large" color="#3033a1" />
        </View>
      </Screen>
    );
  }

  if (error || !teacher) {
    return (
      <Screen title="Welcome" subtitle="Your teaching workspace for today">
        <Card>
          <Text style={{ color: "#c9435e", fontWeight: "600", marginBottom: 12 }}>{error || "Unable to load profile"}</Text>
          <Link href="/login" asChild>
            <Pressable style={{ backgroundColor: "#3033a1", padding: 14, borderRadius: 12, alignItems: "center" }}>
              <Text style={{ color: "white", fontWeight: "800" }}>Sign in</Text>
            </Pressable>
          </Link>
        </Card>
      </Screen>
    );
  }

  const today = records[0];
  const percentage = getAttendancePercentage(records as any);
  const presentCount = records.filter((record) => record.status === "present").length;
  const lateCount = records.filter((record) => record.status === "late").length;

  return (
    <Screen title={greeting()} subtitle="Your teaching workspace for today">
      <AnimatedEntrance delay={40}>
        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroHeader}>
            <View style={styles.avatar}><Text style={styles.avatarText} allowFontScaling={false}>{initials(teacher.fullName)}</Text></View>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow} allowFontScaling={false}>SRI NARAYANA HIGH SCHOOL</Text>
              <Text style={styles.name} numberOfLines={1} allowFontScaling={false}>{teacher.fullName}</Text>
              <Text style={styles.subject} allowFontScaling={false}>{teacher.subject} · {teacher.employeeId}</Text>
            </View>
          </View>
          <View style={styles.heroStatus}>
            <View><Text style={styles.statusLabel} allowFontScaling={false}>TODAY'S ATTENDANCE</Text><Text style={styles.statusCopy} allowFontScaling={false}>Keep your day on track</Text></View>
            <StatusPill status={today?.status ?? "not_marked"} />
          </View>
        </View>
      </AnimatedEntrance>

      <AnimatedEntrance delay={110}>
        <View style={styles.metricRow}>
          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel} allowFontScaling={false}>MONTHLY ATTENDANCE</Text>
            <Text style={styles.metricValue} allowFontScaling={false}>{percentage}%</Text>
            <Text style={styles.metricHint} allowFontScaling={false}>{presentCount} present days</Text>
          </Card>
          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel} allowFontScaling={false}>LAST CHECK-IN</Text>
            <Text style={styles.metricValueSmall} allowFontScaling={false}>{today?.checkInTime ? new Date(today.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</Text>
            <Text style={styles.metricHint} allowFontScaling={false}>{today?.checkInTime ? "Recorded today" : "Ready to record"}</Text>
          </Card>
        </View>
      </AnimatedEntrance>

      <AnimatedEntrance delay={180}>
        <Card>
          <View style={styles.sectionHeader}>
            <View><Text style={styles.sectionTitle} allowFontScaling={false}>Attendance centre</Text><Text style={styles.sectionSubtitle} allowFontScaling={false}>Location is verified before attendance is saved.</Text></View>
            <View style={styles.secureMark}><Text style={styles.secureMarkText} allowFontScaling={false}>GPS</Text></View>
          </View>
          <View style={styles.actionRow}>
            <Link href="/attendance" asChild>
              <Pressable style={({ pressed }) => [styles.checkIn, pressed && styles.pressed]}><Text style={styles.checkInText} allowFontScaling={false}>Check in</Text><Text style={styles.actionArrow} allowFontScaling={false}>→</Text></Pressable>
            </Link>
            <Link href="/attendance" asChild>
              <Pressable style={({ pressed }) => [styles.checkOut, pressed && styles.pressed]}><Text style={styles.checkOutText} allowFontScaling={false}>Check out</Text><Text style={styles.checkOutArrow} allowFontScaling={false}>→</Text></Pressable>
            </Link>
          </View>
        </Card>
      </AnimatedEntrance>

      <AnimatedEntrance delay={250}>
        <View style={styles.shortcutHeader}><Text style={styles.shortcutTitle} allowFontScaling={false}>Quick access</Text><Text style={styles.shortcutHint} allowFontScaling={false}>{lateCount} late mark{lateCount === 1 ? "" : "s"} this month</Text></View>
        <View style={styles.shortcutGrid}>
          <Link href="/calendar" asChild>
            <Pressable style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}><View style={[styles.shortcutIcon, styles.calendarIcon]}><Text style={styles.shortcutIconText} allowFontScaling={false}>CAL</Text></View><Text style={styles.shortcutText} allowFontScaling={false}>Calendar</Text><Text style={styles.shortcutSubtext} allowFontScaling={false}>Monthly record</Text></Pressable>
          </Link>
          <Link href="/history" asChild>
            <Pressable style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}><View style={[styles.shortcutIcon, styles.historyIcon]}><Text style={[styles.shortcutIconText, { color: "#138659" }]} allowFontScaling={false}>LOG</Text></View><Text style={styles.shortcutText} allowFontScaling={false}>History</Text><Text style={styles.shortcutSubtext} allowFontScaling={false}>Recent entries</Text></Pressable>
          </Link>
          <Link href="/profile" asChild>
            <Pressable style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}><View style={[styles.shortcutIcon, styles.profileIcon]}><Text style={[styles.shortcutIconText, { color: "#d58c10" }]} allowFontScaling={false}>ME</Text></View><Text style={styles.shortcutText} allowFontScaling={false}>Profile</Text><Text style={styles.shortcutSubtext} allowFontScaling={false}>Your details</Text></Pressable>
          </Link>
        </View>
      </AnimatedEntrance>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { overflow: "hidden", borderRadius: 22, backgroundColor: "#2c2f8d", padding: 18, shadowColor: "#24266f", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 18, elevation: 4 },
  heroGlow: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "#5458bd", opacity: 0.38, right: -56, top: -70 },
  heroHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 14, backgroundColor: "#f7c548", justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#2b2d82", fontSize: 14, fontWeight: "800" },
  heroCopy: { flex: 1 },
  eyebrow: { color: "#cbd2ff", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  name: { marginTop: 3, color: "white", fontSize: 19, fontWeight: "800" },
  subject: { marginTop: 2, color: "#dbe0ff", fontSize: 12, fontWeight: "600" },
  heroStatus: { marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.14)", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  statusLabel: { color: "#cbd2ff", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  statusCopy: { marginTop: 3, color: "white", fontSize: 14, fontWeight: "700" },
  metricRow: { flexDirection: "row", gap: 12 },
  metricCard: { flex: 1 },
  metricLabel: { color: "#7d86a8", fontSize: 10, fontWeight: "800", letterSpacing: 0.7 },
  metricValue: { marginTop: 8, color: "#1b1d32", fontSize: 30, fontWeight: "800", letterSpacing: -0.8 },
  metricValueSmall: { marginTop: 12, color: "#1b1d32", fontSize: 24, fontWeight: "800", letterSpacing: -0.4 },
  metricHint: { marginTop: 5, color: "#7d86a8", fontSize: 12, fontWeight: "600" },
  sectionHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  sectionTitle: { color: "#252740", fontSize: 17, fontWeight: "800" },
  sectionSubtitle: { marginTop: 4, color: "#7d86a8", fontSize: 12, lineHeight: 17, maxWidth: 235 },
  secureMark: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#eeefff", alignItems: "center", justifyContent: "center" },
  secureMarkText: { color: "#3033a1", fontSize: 10, fontWeight: "800" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  checkIn: { flex: 1, minHeight: 52, borderRadius: 14, backgroundColor: "#2d3094", paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  checkInText: { color: "white", fontSize: 15, fontWeight: "800" },
  actionArrow: { color: "#f7c548", fontSize: 22, fontWeight: "600" },
  checkOut: { flex: 1, minHeight: 52, borderRadius: 14, backgroundColor: "#f2f3fa", paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  checkOutText: { color: "#353779", fontSize: 15, fontWeight: "800" },
  checkOutArrow: { color: "#353779", fontSize: 22, fontWeight: "600" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  shortcutHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginTop: 2 },
  shortcutTitle: { color: "#252740", fontSize: 17, fontWeight: "800" },
  shortcutHint: { color: "#7d86a8", fontSize: 11, fontWeight: "600" },
  shortcutGrid: { flexDirection: "row", gap: 10 },
  shortcut: { flex: 1, minHeight: 132, borderWidth: 1, borderColor: "#e3e6f0", backgroundColor: "white", borderRadius: 18, padding: 12, shadowColor: "#242a5e", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 1 },
  shortcutIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  calendarIcon: { backgroundColor: "#eeefff" },
  historyIcon: { backgroundColor: "#e5f8ee" },
  profileIcon: { backgroundColor: "#fff4df" },
  shortcutIconText: { color: "#3033a1", fontSize: 9, fontWeight: "800" },
  shortcutText: { marginTop: 12, color: "#292b41", fontSize: 13, fontWeight: "800" },
  shortcutSubtext: { marginTop: 3, color: "#8490ae", fontSize: 10, fontWeight: "600" }
});