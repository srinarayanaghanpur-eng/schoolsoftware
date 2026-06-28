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

function DistanceBar({ distance, radius }: { distance: number | null; radius: number }) {
  if (distance === null) {
    return (
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: 0, backgroundColor: "#dfe3f2" }]} />
      </View>
    );
  }
  const pct = Math.min((distance / radius) * 100, 100);
  const inside = distance <= radius;
  return (
    <View>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${pct}%`, backgroundColor: inside ? "#148654" : "#c9435e" }
          ]}
        />
      </View>
      <Text style={[styles.barLabel, { color: inside ? "#148654" : "#c9435e" }]} allowFontScaling={false}>
        {inside ? "Inside campus" : "Outside campus"} &middot; {distance}m / {radius}m
      </Text>
    </View>
  );
}

export default function Attendance() {
  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SETTINGS);
  const [distance, setDistance] = useState<number | null>(null);
  const [currentGps, setCurrentGps] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState<"checkin" | "checkout" | null>(null);

  useEffect(() => {
    getDoc(doc(db, "settings", "school"))
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
      const teacherId = typeof token?.claims.teacherId === "string" ? token.claims.teacherId : (() => { throw new Error("Missing teacherId in auth claims. Cannot mark attendance."); })();

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

  const inside = distance !== null && distance <= settings.geofenceRadiusMeters;
  const locationKnown = currentGps !== null;

  return (
    <Screen title="Attendance" subtitle="Mark check-in or check-out from inside campus.">
      <Card style={styles.statusCard}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.kicker} allowFontScaling={false}>GPS SECURE</Text>
            <Text style={styles.cardTitle} allowFontScaling={false}>Location status</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: locationKnown ? (inside ? "#e4f7ec" : "#fee9ed") : "#f8f9ff" }]}>
            <Text style={[styles.statusBadgeText, { color: locationKnown ? (inside ? "#148654" : "#c9435e") : "#9aa3bd" }]} allowFontScaling={false}>
              {locationKnown ? (inside ? "OK" : "OUT") : "---"}
            </Text>
          </View>
        </View>

        <Text style={styles.label} allowFontScaling={false}>Campus location</Text>
        <Text style={styles.value} allowFontScaling={false}>
          {settings.campusLatitude.toFixed(4)}, {settings.campusLongitude.toFixed(4)}
        </Text>

        <Text style={styles.label} allowFontScaling={false}>Allowed radius</Text>
        <Text style={styles.value} allowFontScaling={false}>{settings.geofenceRadiusMeters} meters</Text>

        <View style={styles.divider} />

        <Text style={styles.label} allowFontScaling={false}>Distance from campus</Text>
        <DistanceBar distance={distance} radius={settings.geofenceRadiusMeters} />
      </Card>

      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, pressed && styles.pressed, Boolean(loading) && styles.disabled]}
          disabled={Boolean(loading)}
          onPress={() => mark("checkin")}
        >
          <Text style={styles.primaryText} allowFontScaling={false}>{loading === "checkin" ? "Checking..." : "Check in"}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed, Boolean(loading) && styles.disabled]}
          disabled={Boolean(loading)}
          onPress={() => mark("checkout")}
        >
          <Text style={styles.secondaryText} allowFontScaling={false}>{loading === "checkout" ? "Checking..." : "Check out"}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusCard: { gap: 2 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18 },
  kicker: { color: "#3033a1", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  cardTitle: { marginTop: 4, color: "#1b1d32", fontSize: 20, fontWeight: "900", letterSpacing: -0.4 },
  statusBadge: { width: 52, height: 52, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  statusBadgeText: { fontSize: 13, fontWeight: "900" },
  label: { color: "#7d86a8", marginBottom: 6, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.4 },
  value: { fontSize: 16, fontWeight: "900", color: "#1b1d32", marginBottom: 14 },
  divider: { height: 1, backgroundColor: "#e3e6f0", marginVertical: 12 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: "#edf0f7", overflow: "hidden", marginBottom: 6 },
  barFill: { height: "100%", borderRadius: 4 },
  barLabel: { fontSize: 12, fontWeight: "800", marginBottom: 14 },
  row: { flexDirection: "row", gap: 12 },
  primary: { flex: 1, minHeight: 56, backgroundColor: "#3033a1", padding: 16, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  primaryText: { color: "white", textAlign: "center", fontWeight: "900", fontSize: 16 },
  secondary: { flex: 1, minHeight: 56, backgroundColor: "white", borderColor: "#dfe3f2", borderWidth: 1, padding: 16, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  secondaryText: { color: "#3033a1", textAlign: "center", fontWeight: "900", fontSize: 16 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.6 }
});
