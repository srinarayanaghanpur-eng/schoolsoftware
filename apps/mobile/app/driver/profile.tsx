import React, { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Avatar,
  Badge,
  ConfirmDialog,
  DSText,
  Icon,
  ListRow,
  PillButton,
  SectionCard,
  TonalTile,
  useToast
} from "@/design-system/components";
import { space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import { DriverShell } from "@/features/driver/shell";
import { LocationTutorialModal } from "@/features/driver/LocationTutorialModal";
import { useDriverDemo } from "@/features/driver/DriverDemoContext";
import { useMobileSession } from "@/lib/mobileSession";

export default function DriverProfileScreen() {
  return (
    <DriverShell>
      <DriverProfile />
    </DriverShell>
  );
}

function DriverProfile() {
  const { t } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { logout } = useMobileSession();
  const {
    loading,
    refresh,
    refreshLocationPermission,
    profile,
    attendance,
    journey,
    location,
    distanceKm,
    totalStudents
  } = useDriverDemo();
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      router.replace("/login" as never);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Logout failed. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  };

  const initials = profile.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  return (
    <>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.lg }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => { void refresh(); void refreshLocationPermission(); }}
            tintColor={t.blue}
          />
        }
      >
        <LinearGradient
          colors={[t.heroFrom, t.heroMid, t.heroTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 24, padding: 20, flexDirection: "row", alignItems: "center", gap: 14 }}
        >
          <Avatar label={initials} size={68} bg="rgba(255,255,255,0.2)" fg={t.card} />
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <DSText variant="title" tint={t.card} style={{ fontSize: 19 }} numberOfLines={1}>{profile.name}</DSText>
            <DSText variant="label" tint="rgba(255,255,255,0.86)">
              Driver{profile.employeeId ? ` · ${profile.employeeId}` : ""}
            </DSText>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
              {profile.busNo ? <Badge label={profile.busNo} bg="rgba(255,255,255,0.18)" fg={t.card} /> : null}
              {profile.routeCode || profile.routeName ? (
                <Badge label={profile.routeCode || profile.routeName} bg="rgba(255,255,255,0.18)" fg={t.card} />
              ) : null}
            </View>
          </View>
        </LinearGradient>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <TonalTile bg={t.okBg} size={42}>
              <Icon name={attendance.marked ? "verified-user" : "face"} size={22} tint={attendance.marked ? t.ok : t.blue} />
            </TonalTile>
            <DSText variant="bodyMedium" style={{ marginTop: 7 }}>{attendance.marked ? "Present" : "Not marked"}</DSText>
            <DSText variant="caption">{attendance.at ?? "Face attendance"}</DSText>
          </View>
          <View style={{ flex: 1 }}>
            <TonalTile bg={t.tint} size={42}>
              <Icon name="route" size={22} tint={t.blue} />
            </TonalTile>
            <DSText variant="bodyMedium" style={{ marginTop: 7 }}>{journey.status === "idle" ? "Not started" : journey.status === "active" ? "On route" : "Completed"}</DSText>
            <DSText variant="caption">{distanceKm.toFixed(1)} km · {totalStudents} students</DSText>
          </View>
          <View style={{ flex: 1 }}>
            <TonalTile bg={location.permission === "background" ? t.okBg : t.warnBg} size={42}>
              <Icon name="my-location" size={22} tint={location.permission === "background" ? t.ok : t.warn} />
            </TonalTile>
            <DSText variant="bodyMedium" style={{ marginTop: 7 }}>
              {location.permission === "background" ? "All the time" : location.permission === "foreground" ? "While using" : "Needs access"}
            </DSText>
            <DSText variant="caption">Location</DSText>
          </View>
        </View>

        <SectionCard heading="DRIVER DETAILS">
          <ListRow
            leading={<TonalTile bg={t.tint}><Icon name="badge" size={19} tint={t.blue} /></TonalTile>}
            title="Employee ID"
            subtitle={profile.employeeId || "Not set"}
          />
          <ListRow
            leading={<TonalTile bg={t.okBg}><Icon name="phone" size={19} tint={t.ok} /></TonalTile>}
            title="Phone"
            subtitle={profile.phone || "Not set"}
          />
          {profile.licenseNo ? (
            <ListRow
              leading={<TonalTile bg={t.warnBg}><Icon name="credit-card" size={19} tint={t.warn} /></TonalTile>}
              title="Driving licence"
              subtitle={`${profile.licenseNo}${profile.licenseExpiry ? ` · valid to ${profile.licenseExpiry}` : ""}`}
            />
          ) : null}
          <ListRow
            leading={<TonalTile bg={t.tint}><Icon name="directions-bus" size={19} tint={t.blue} /></TonalTile>}
            title="Assigned bus"
            subtitle={profile.busNo ? `${profile.busNo} · ${profile.busModel}` : "Not assigned"}
          />
          <ListRow
            leading={<TonalTile bg={t.tint}><Icon name="alt-route" size={19} tint={t.blue} /></TonalTile>}
            title="Assigned route"
            subtitle={
              profile.routeCode
                ? `${profile.routeCode} · ${profile.routeName}`
                : profile.routeName || "Not assigned"
            }
          />
        </SectionCard>

        <SectionCard
          heading="LOCATION PERMISSION"
          trailing={
            <Badge
              label={location.permission === "background" ? "READY" : "ACTION"}
              bg={location.permission === "background" ? t.okBg : t.warnBg}
              fg={location.permission === "background" ? t.ok : t.warn}
            />
          }
        >
          <View style={{ gap: 10 }}>
            <DSText variant="body">
              {location.permission === "background"
                ? "Background location is allowed for active bus duty."
                : "Choose Allow all the time in Android settings so location access stays ready during a journey. The app asks once; Android stores the choice."}
            </DSText>
            <PillButton label="Show me how" icon="help-outline" block onPress={() => setTutorialOpen(true)} />
          </View>
        </SectionCard>

        <DSText variant="caption" style={{ textAlign: "center" }}>
          NarayanaOS · Driver
        </DSText>

        <PillButton
          label="Sign out"
          icon="logout"
          bg={t.bad}
          block
          onPress={() => setConfirmOpen(true)}
        />
      </ScrollView>

      <LocationTutorialModal visible={tutorialOpen} onClose={() => setTutorialOpen(false)} />
      <ConfirmDialog
        visible={confirmOpen}
        title="Sign out?"
        message="You are getting logged out from this device."
        confirmLabel="Sign out"
        busy={loggingOut}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => { setConfirmOpen(false); void handleLogout(); }}
      />
    </>
  );
}
