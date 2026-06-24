import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { postAttendance } from "@/lib/api";
import { auth, db } from "@/lib/firebase";
import { DEFAULT_SETTINGS, getDistanceFromCampus, isInsideCampus, type SchoolSettings } from "@sri-narayana/shared";
import * as Device from "expo-device";
import * as Location from "expo-location";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

const DEMO_TEACHER_ID = "teacher_anita";

export default function Attendance() {
  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SETTINGS);
  const [distance, setDistance] = useState<number | null>(null);
  const [currentGps, setCurrentGps] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState<"checkin" | "checkout" | null>(null);

  useEffect(() => {
    getDoc<Partial<SchoolSettings>>(doc(db, "settings", "school"))
      .then((snapshot) => {
        if (snapshot.exists()) {
          setSettings({ ...DEFAULT_SETTINGS, ...snapshot.data() });
        }
      })
      .catch(() => {
        setSettings(DEFAULT_SETTINGS);
      });
  }, []);

  const mark = async (eventType: "checkin" | "checkout") => {
    setLoading(eventType);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        throw new Error("Location permission is required for attendance.");
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const point = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracyMeters: location.coords.accuracy ?? undefined
      };
      setCurrentGps({ latitude: point.latitude, longitude: point.longitude });
      const currentDistance = getDistanceFromCampus(point, settings);
      setDistance(currentDistance);

      if (!isInsideCampus(point, settings)) {
        throw new Error("You are outside campus. Attendance not allowed.");
      }

      const token = await auth.currentUser?.getIdTokenResult();
      const teacherId = typeof token?.claims.teacherId === "string" ? token.claims.teacherId : DEMO_TEACHER_ID;

      await postAttendance({
        teacherId,
        eventType,
        timestamp: new Date().toISOString(),
        latitude: point.latitude,
        longitude: point.longitude,
        accuracyMeters: point.accuracyMeters,
        deviceInfo: `${Device.manufacturer ?? "Unknown"} ${Device.modelName ?? "Device"}`
      });
      Alert.alert("Attendance saved", eventType === "checkin" ? "Your check-in was recorded." : "Your check-out was recorded.");
    } catch (error) {
      Alert.alert("Attendance blocked", error instanceof Error ? error.message : "Unable to mark attendance.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <Screen title="Mark Attendance" subtitle="GPS must be inside the configured campus radius.">
      <Card>
        <Text style={styles.label}>School location</Text>
        <Text style={styles.value}>{settings.campusLatitude.toFixed(6)}, {settings.campusLongitude.toFixed(6)}</Text>
        <Text style={styles.label}>Campus radius</Text>
        <Text style={styles.value}>{settings.geofenceRadiusMeters} meters</Text>
        <View style={styles.divider} />
        <Text style={styles.label}>Your GPS</Text>
        <Text style={styles.value}>{currentGps ? `${currentGps.latitude.toFixed(6)}, ${currentGps.longitude.toFixed(6)}` : "--"}</Text>
        <Text style={styles.label}>Distance from campus</Text>
        <Text style={[styles.value, distance && distance > settings.geofenceRadiusMeters ? { color: "#dc2626" } : { color: "#047857" }]}>
          {distance === null ? "--" : `${distance} meters`}
        </Text>
      </Card>
      <View style={styles.row}>
        <Pressable style={[styles.primary, Boolean(loading) && styles.disabled]} disabled={Boolean(loading)} onPress={() => mark("checkin")}>
          <Text style={styles.primaryText}>{loading === "checkin" ? "Checking..." : "Check in"}</Text>
        </Pressable>
        <Pressable style={[styles.secondary, Boolean(loading) && styles.disabled]} disabled={Boolean(loading)} onPress={() => mark("checkout")}>
          <Text style={styles.secondaryText}>{loading === "checkout" ? "Checking..." : "Check out"}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: "#66736a", marginBottom: 6, fontSize: 13, fontWeight: "600" },
  value: { fontSize: 16, fontWeight: "700", color: "#17211b", marginBottom: 14 },
  divider: { height: 1, backgroundColor: "#d6d3d1", marginVertical: 12 },
  row: { flexDirection: "row", gap: 12 },
  primary: { flex: 1, backgroundColor: "#047857", padding: 16, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  primaryText: { color: "white", textAlign: "center", fontWeight: "700", fontSize: 16 },
  secondary: { flex: 1, backgroundColor: "white", borderColor: "#d6d3d1", borderWidth: 1, padding: 16, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  secondaryText: { color: "#17211b", textAlign: "center", fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.6 }
});
