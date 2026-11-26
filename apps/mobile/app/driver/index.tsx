import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, RefreshControl, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Avatar,
  Badge,
  BottomSheet,
  Card,
  DSText,
  FilterChips,
  Icon,
  PillButton,
  PressableScale,
  ProgressBar,
  ScreenHeader,
  SectionCard,
  StatTile,
  TonalTile,
  useToast
} from "@/design-system/components";
import { space } from "@/design-system/tokens";
import FunLoader from "@/design-system/FunLoader";
import { useTheme } from "@/lib/Theme";
import { DriverShell } from "@/features/driver/shell";
import { FaceCheckModal } from "@/features/driver/FaceCheckModal";
import { LocationTutorialModal } from "@/features/driver/LocationTutorialModal";
import { SwipeToStart } from "@/features/driver/SwipeToStart";
import {
  useDriverDemo,
  type JourneyMode
} from "@/features/driver/DriverDemoContext";

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function formatDistance(value: number) {
  return `${value.toFixed(1)} km`;
}

function relativeFix(lastFixAt: number | null, now: number) {
  if (!lastFixAt) return "Waiting for GPS";
  const seconds = Math.max(0, Math.floor((now - lastFixAt) / 1000));
  if (seconds < 5) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

function PulseDot() {
  const { t } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 750, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={{ width: 18, height: 18, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          position: "absolute",
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: t.ok,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.6] }) }]
        }}
      />
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: t.ok }} />
    </View>
  );
}

export default function DriverHomeRoute() {
  return (
    <DriverShell>
      <DriverHome />
    </DriverShell>
  );
}

function DriverHome() {
  const { t } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const {
    loading,
    error,
    refresh,
    profile,
    stops,
    mode: tripMode,
    attendance,
    journey,
    location,
    now,
    distanceKm,
    totalStudents,
    markAttendance,
    startJourney,
    endJourney,
    completeStop,
    requestLocation,
    refreshLocationPermission
  } = useDriverDemo();

  const [faceOpen, setFaceOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [countOpen, setCountOpen] = useState(false);
  const [mode, setMode] = useState<JourneyMode>("morning");
  const [count, setCount] = useState(0);

  const nextStop = stops[journey.nextStopIndex];
  const elapsed = journey.startedAt
    ? Math.max(0, Math.floor(((journey.endedAt ?? now) - journey.startedAt) / 1000))
    : 0;
  const speedKmh = location.speed != null ? Math.max(0, Math.round(location.speed * 3.6)) : 0;
  const gpsReady = location.permission === "background" || location.permission === "foreground";
  const journeyLabel = journey.mode === "morning" ? "Morning pickup" : "Evening drop";
  const progress = stops.length > 0 ? (journey.nextStopIndex / stops.length) * 100 : 0;

  async function enableLocation() {
    const result = await requestLocation();
    if (result === "background") {
      toast.show("Location enabled for active journeys");
      return;
    }
    setTutorialOpen(true);
  }

  function openCount() {
    if (!nextStop) return;
    setCount(journey.counts[nextStop.id] ?? 0);
    setCountOpen(true);
  }

  async function saveCount() {
    if (!nextStop) return;
    const ok = await completeStop(nextStop.id, count);
    setCountOpen(false);
    if (ok) toast.show(`${nextStop.name}: ${count} student${count === 1 ? "" : "s"}`);
    else toast.show("Could not save count. Try again.");
  }

  async function confirmStart() {
    if (!gpsReady) {
      setStartOpen(false);
      toast.show("Enable location before starting the journey.");
      setTutorialOpen(true);
      return;
    }
    setStartOpen(false);
    const ok = await startJourney(mode);
    toast.show(
      ok
        ? `${mode === "morning" ? "Morning pickup" : "Evening drop"} started`
        : "Could not start trip. Try again."
    );
  }

  async function confirmEnd() {
    const ok = await endJourney();
    setEndOpen(false);
    toast.show(ok ? "Journey ended" : "Could not end trip. Try again.");
  }

  if (loading && !profile.name) {
    return <FunLoader />;
  }

  if (error && !profile.name) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: space.lg }}>
        <Icon name="error-outline" size={36} tint={t.bad} />
        <DSText variant="bodyMedium" style={{ textAlign: "center" }}>{error}</DSText>
        <DSText variant="caption" style={{ textAlign: "center" }}>
          Ask the transport office to assign your bus and route, then retry.
        </DSText>
        <PillButton label="Retry" icon="refresh" onPress={() => { void refresh(); }} />
      </View>
    );
  }

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
        <ScreenHeader
          eyebrow="DRIVER"
          title={`Hi, ${profile.name.split(" ")[0]}`}
          trailing={
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <PressableScale accessibilityLabel="Refresh driver dashboard" onPress={() => { void refresh(); }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: t.tint,
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  {loading ? <ActivityIndicator color={t.blue} /> : <Icon name="refresh" size={22} tint={t.blue} />}
                </View>
              </PressableScale>
              <PressableScale accessibilityLabel="Open driver profile" onPress={() => router.push("/driver/profile" as never)}>
                <Avatar label={profile.name.split(" ").map((part) => part[0]).join("").slice(0, 2)} size={44} />
              </PressableScale>
            </View>
          }
        />

        <LinearGradient
          colors={[t.heroFrom, t.heroMid, t.heroTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 24, padding: 18, gap: 14 }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <DSText variant="overline" tint="rgba(255,255,255,0.78)">ASSIGNED BUS</DSText>
              <DSText variant="display" tint={t.card} style={{ fontSize: 27, marginTop: 2 }}>{profile.busNo}</DSText>
              <DSText variant="bodyMedium" tint="rgba(255,255,255,0.9)">{profile.busModel} · {profile.capacity} seats</DSText>
            </View>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                backgroundColor: "rgba(255,255,255,0.18)",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Icon name="directions-bus" size={30} tint={t.card} />
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Badge label={profile.routeCode} bg="rgba(255,255,255,0.18)" fg={t.card} />
            <Badge label={profile.routeName} bg="rgba(255,255,255,0.18)" fg={t.card} />
            <Badge label={journeyLabel} bg="rgba(255,255,255,0.18)" fg={t.card} />
          </View>
        </LinearGradient>

        <SectionCard
          heading="DRIVER ATTENDANCE"
          trailing={attendance.marked ? <Badge label="PRESENT" bg={t.okBg} fg={t.ok} /> : null}
        >
          {attendance.marked ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <TonalTile bg={t.okBg} size={44}>
                <Icon name="verified-user" size={23} tint={t.ok} />
              </TonalTile>
              <View style={{ flex: 1, gap: 2 }}>
                <DSText variant="bodyMedium">Face attendance marked</DSText>
                <DSText variant="caption">At {attendance.at} · on-device check</DSText>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <TonalTile bg={t.tint} size={44}>
                <Icon name="face" size={24} tint={t.blue} />
              </TonalTile>
              <View style={{ flex: 1, gap: 2 }}>
                <DSText variant="bodyMedium">Mark driver attendance</DSText>
                <DSText variant="caption">Optional face check stays on this device</DSText>
              </View>
              <PillButton label="Verify face" icon="face" onPress={() => setFaceOpen(true)} />
            </View>
          )}
        </SectionCard>

        <SectionCard
          heading="LOCATION ACCESS"
          trailing={
            <Badge
              label={location.permission === "background" ? "ALL THE TIME" : gpsReady ? "WHILE USING" : "NEEDED"}
              bg={location.permission === "background" ? t.okBg : gpsReady ? t.warnBg : t.badBg}
              fg={location.permission === "background" ? t.ok : gpsReady ? t.warn : t.bad}
            />
          }
        >
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <TonalTile
                bg={location.permission === "background" ? t.okBg : gpsReady ? t.warnBg : t.badBg}
                size={42}
              >
                <Icon
                  name={location.permission === "background" ? "location-on" : "location-off"}
                  size={22}
                  tint={location.permission === "background" ? t.ok : gpsReady ? t.warn : t.bad}
                />
              </TonalTile>
              <View style={{ flex: 1, gap: 2 }}>
                <DSText variant="bodyMedium">
                  {location.permission === "background"
                    ? "Background location ready"
                    : location.permission === "foreground"
                      ? "While using the app only"
                      : "Allow all the time for bus duty"}
                </DSText>
                <DSText variant="caption">
                  {location.permission === "background"
                    ? "Background access is allowed for active bus duty."
                    : "Allow all the time so location access stays ready when the screen locks."}
                </DSText>
              </View>
            </View>
            {location.error ? <DSText variant="caption" tint={t.warn}>{location.error}</DSText> : null}
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <PillButton
                  label={location.permission === "background" ? "Permission ready" : "Enable location"}
                  block
                  icon="my-location"
                  bg={location.permission === "background" ? t.ok : t.blue}
                  onPress={() => { void enableLocation(); }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <PillButton
                  label="How to"
                  block
                  bg={t.tint}
                  fg={t.blue}
                  onPress={() => setTutorialOpen(true)}
                />
              </View>
            </View>
          </View>
        </SectionCard>

        <SectionCard heading={journey.status === "idle" ? "START ROUTE" : "TODAY'S JOURNEY"}>
          {journey.status === "idle" ? (
            <View style={{ gap: space.md }}>
              <FilterChips
                options={["Morning pickup", "Evening drop"]}
                value={mode === "morning" ? "Morning pickup" : "Evening drop"}
                onChange={(value) => setMode(value === "Morning pickup" ? "morning" : "evening")}
              />
              <SwipeToStart
                label={`Swipe to start ${mode === "morning" ? "morning pickup" : "evening drop"}`}
                hint={gpsReady ? "Swipe the arrow to start" : "Enable location first"}
                disabled={tripMode === "first_day" || !gpsReady}
                onComplete={() => setStartOpen(true)}
              />
              {!gpsReady ? (
                <DSText variant="caption" tint={t.warn}>
                  Enable location above before starting the journey.
                </DSText>
              ) : null}
              {tripMode === "first_day" ? (
                <DSText variant="caption" tint={t.warn}>
                  First-day mode is active. The transport office records the baseline before daily trips begin.
                </DSText>
              ) : (
                <DSText variant="caption">
                  Route {profile.routeCode} · {stops.length} stops · {profile.routeKm.toFixed(1)} km
                </DSText>
              )}
            </View>
          ) : journey.status === "active" ? (
            <View style={{ gap: space.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <PulseDot />
                <View style={{ flex: 1, gap: 2 }}>
                  <DSText variant="bodyMedium">{journeyLabel} in progress</DSText>
                  <DSText variant="caption">
                    {relativeFix(location.lastFixAt, now)} · {location.accuracy != null ? `±${Math.round(location.accuracy)}m` : "GPS pending"}
                  </DSText>
                </View>
                <DSText variant="display" style={{ fontSize: 21 }}>{formatTimer(elapsed)}</DSText>
              </View>
              <ProgressBar percent={progress} tint={t.ok} />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}><StatTile value={formatDistance(distanceKm)} label="Distance" tint={t.blue} /></View>
                <View style={{ flex: 1 }}><StatTile value={speedKmh > 0 ? `${speedKmh}` : "—"} label="km/h" tint={t.ok} /></View>
                <View style={{ flex: 1 }}><StatTile value={`${journey.nextStopIndex}/${stops.length}`} label="Stops" tint={t.warn} /></View>
              </View>
              {nextStop ? (
                <Card style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: t.tint,
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <DSText variant="bodyMedium" tint={t.blue}>{journey.nextStopIndex + 1}</DSText>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <DSText variant="bodyMedium">{nextStop.name}</DSText>
                    <DSText variant="caption">{nextStop.eta} · {journey.counts[nextStop.id] != null ? `${journey.counts[nextStop.id]} students` : "Count pending"}</DSText>
                  </View>
                  <PillButton
                    label={journey.counts[nextStop.id] != null ? "Update" : "Count"}
                    bg={t.tint}
                    fg={t.blue}
                    onPress={openCount}
                  />
                </Card>
              ) : (
                <DSText variant="bodyMedium" tint={t.ok}>All route stops completed.</DSText>
              )}
              <SwipeToStart
                tone="danger"
                label="Swipe to end journey"
                hint="Swipe the arrow to end"
                onComplete={() => setEndOpen(true)}
              />
            </View>
          ) : (
            <View style={{ gap: space.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <TonalTile bg={t.okBg} size={42}>
                  <Icon name="check-circle" size={24} tint={t.ok} />
                </TonalTile>
                <View style={{ flex: 1, gap: 2 }}>
                  <DSText variant="bodyMedium">{journeyLabel} completed</DSText>
                  <DSText variant="caption">{formatTimer(elapsed)} · {formatDistance(distanceKm)} · {totalStudents} students</DSText>
                </View>
              </View>
              <PillButton
                label="Start evening drop"
                icon="wb-twilight"
                block
                onPress={() => {
                  setMode("evening");
                  setStartOpen(true);
                }}
              />
            </View>
          )}
        </SectionCard>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><StatTile value={formatDistance(distanceKm)} label="Today's distance" tint={t.blue} /></View>
          <View style={{ flex: 1 }}><StatTile value={`${journey.nextStopIndex}/${stops.length}`} label="Stops covered" tint={t.warn} /></View>
          <View style={{ flex: 1 }}><StatTile value={totalStudents} label="Students" tint={t.ok} /></View>
        </View>

        <SectionCard heading="GPS STATUS">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TonalTile bg={gpsReady ? t.okBg : t.badBg} size={42}>
              <Icon name={gpsReady ? "gps-fixed" : "gps-off"} size={22} tint={gpsReady ? t.ok : t.bad} />
            </TonalTile>
            <View style={{ flex: 1, gap: 2 }}>
              <DSText variant="bodyMedium">
                {gpsReady ? "Location service available" : "Location service not ready"}
              </DSText>
              <DSText variant="caption">
                {location.lastFixAt
                  ? `Last fix ${relativeFix(location.lastFixAt, now)} · accuracy ${location.accuracy != null ? `±${Math.round(location.accuracy)}m` : "unknown"}`
                  : "No GPS fix yet. Start a journey after enabling location."}
              </DSText>
            </View>
          </View>
        </SectionCard>

        {error ? (
          <DSText variant="caption" tint={t.bad} style={{ textAlign: "center" }}>{error}</DSText>
        ) : null}
        <DSText variant="caption" style={{ textAlign: "center" }}>
          Counts are saved to the school server. No student names or IDs are shown to drivers.
        </DSText>
      </ScrollView>

      <FaceCheckModal
        visible={faceOpen}
        onClose={() => setFaceOpen(false)}
        onVerified={() => {
          markAttendance();
          toast.show("Face attendance marked");
        }}
      />
      <LocationTutorialModal visible={tutorialOpen} onClose={() => setTutorialOpen(false)} />

      <BottomSheet
        visible={startOpen}
        title={`Start ${mode === "morning" ? "morning pickup" : "evening drop"}?`}
        onClose={() => setStartOpen(false)}
        primaryLabel="Start journey"
        onPrimary={confirmStart}
      >
        <View style={{ gap: 8 }}>
          <DSText variant="bodyMedium">{profile.busNo} · {profile.routeName}</DSText>
          <DSText variant="label">{stops.length} stops · {profile.routeKm.toFixed(1)} km · {profile.capacity} seats</DSText>
          <DSText variant="caption">
            Location will update while the journey is active. Keep the app available and the phone charged.
          </DSText>
        </View>
      </BottomSheet>

      <BottomSheet
        visible={endOpen}
        title="End journey?"
        onClose={() => setEndOpen(false)}
        primaryLabel="End journey"
        onPrimary={confirmEnd}
      >
        <View style={{ gap: 8 }}>
          <DSText variant="bodyMedium">{formatTimer(elapsed)} · {formatDistance(distanceKm)}</DSText>
          <DSText variant="label">{journey.nextStopIndex} of {stops.length} stops completed · {totalStudents} students counted</DSText>
          <DSText variant="caption">Any pending stop counts will stay available after the journey ends.</DSText>
        </View>
      </BottomSheet>

      <BottomSheet
        visible={countOpen}
        title={nextStop ? nextStop.name : "Stop count"}
        onClose={() => setCountOpen(false)}
        primaryLabel="Save count"
        onPrimary={saveCount}
      >
        <View style={{ alignItems: "center", gap: space.md }}>
          <DSText variant="label" style={{ textAlign: "center" }}>
            {journey.mode === "morning" ? "Students picked up at this stop" : "Students dropped at this stop"}
          </DSText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.xl }}>
            <PressableScale
              accessibilityLabel="Decrease count"
              onPress={() => setCount((value) => Math.max(0, value - 1))}
            >
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.tint, alignItems: "center", justifyContent: "center" }}>
                <Icon name="remove" size={24} tint={t.blue} />
              </View>
            </PressableScale>
            <DSText variant="display" style={{ fontSize: 42 }}>{count}</DSText>
            <PressableScale
              accessibilityLabel="Increase count"
              onPress={() => setCount((value) => value + 1)}
            >
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.tint, alignItems: "center", justifyContent: "center" }}>
                <Icon name="add" size={24} tint={t.blue} />
              </View>
            </PressableScale>
          </View>
          <DSText variant="caption" style={{ textAlign: "center" }}>
            Zero is allowed. Counts are aggregate only; no individual student attendance is recorded here.
          </DSText>
        </View>
      </BottomSheet>
    </>
  );
}
