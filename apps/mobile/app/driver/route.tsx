import React, { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import {
  Badge,
  BottomSheet,
  Card,
  DSText,
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
import { useTheme } from "@/lib/Theme";
import { DriverShell } from "@/features/driver/shell";
import { useDriverDemo, type DriverStop } from "@/features/driver/DriverDemoContext";

export default function DriverRouteScreen() {
  return (
    <DriverShell>
      <DriverRoute />
    </DriverShell>
  );
}

function DriverRoute() {
  const { t } = useTheme();
  const toast = useToast();
  const {
    loading,
    refresh,
    refreshLocationPermission,
    profile,
    stops,
    journey,
    location,
    now,
    distanceKm,
    totalStudents,
    completeStop
  } = useDriverDemo();

  const [selected, setSelected] = useState<DriverStop | null>(null);
  const [count, setCount] = useState(0);

  const openCount = (stop: DriverStop) => {
    if (journey.status !== "active") {
      toast.show("Start a journey before entering stop counts.");
      return;
    }
    setSelected(stop);
    setCount(journey.counts[stop.id] ?? 0);
  };

  const saveCount = async () => {
    if (!selected) return;
    const ok = await completeStop(selected.id, count);
    setSelected(null);
    toast.show(
      ok
        ? `${selected.name}: ${count} student${count === 1 ? "" : "s"}`
        : "Could not save count. Try again."
    );
  };

  const progress = stops.length > 0 ? (journey.nextStopIndex / stops.length) * 100 : 0;
  const accuracy = location.accuracy != null ? Math.round(location.accuracy) : null;

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
          eyebrow={journey.mode === "morning" ? "MORNING PICKUP" : "EVENING DROP"}
          title={`Route ${profile.routeCode}`}
          trailing={<Badge label={journey.status.toUpperCase()} bg={t.tint} fg={t.blue} />}
        />

        <Card style={{ padding: space.lg, gap: space.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <TonalTile bg={t.tint} size={46}>
              <Icon name="alt-route" size={24} tint={t.blue} />
            </TonalTile>
            <View style={{ flex: 1, gap: 2 }}>
              <DSText variant="bodyMedium">{profile.routeName}</DSText>
              <DSText variant="caption">{profile.busNo} · {profile.routeKm.toFixed(1)} km · {profile.capacity} seats</DSText>
            </View>
          </View>
          <ProgressBar percent={progress} tint={t.ok} />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <DSText variant="caption">Stop {Math.min(journey.nextStopIndex + 1, stops.length)} of {stops.length}</DSText>
            <DSText variant="caption">{Math.round(progress)}% complete</DSText>
          </View>
          {journey.status === "idle" ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Icon name="info" size={16} tint={t.warn} />
              <DSText variant="caption" tint={t.warn} style={{ flex: 1 }}>
                Start the journey from Home to begin stop detection.
              </DSText>
            </View>
          ) : null}
        </Card>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><StatTile value={`${distanceKm.toFixed(1)}`} label="km today" tint={t.blue} /></View>
          <View style={{ flex: 1 }}><StatTile value={`${journey.nextStopIndex}/${stops.length}`} label="stops" tint={t.warn} /></View>
          <View style={{ flex: 1 }}><StatTile value={totalStudents} label="students" tint={t.ok} /></View>
        </View>

        <SectionCard heading="STOP TIMELINE">
          <View style={{ gap: 2 }}>
            {stops.map((stop, index) => {
              const done = index < journey.nextStopIndex;
              const next = index === journey.nextStopIndex && journey.status === "active";
              const saved = journey.counts[stop.id];
              return (
                <PressableScale
                  key={stop.id}
                  accessibilityLabel={`${stop.name}, ${saved != null ? `${saved} students` : "count pending"}`}
                  onPress={() => openCount(stop)}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 12,
                    paddingVertical: 10,
                    paddingHorizontal: 8,
                    borderRadius: 12,
                    backgroundColor: next ? t.tint : "transparent"
                  }}
                >
                  <View style={{ alignItems: "center", width: 28 }}>
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: done ? t.okBg : next ? t.blue : t.card,
                        borderWidth: 1.5,
                        borderColor: done ? t.ok : next ? t.blue : t.line,
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      {done ? (
                        <Icon name="check" size={16} tint={t.ok} />
                      ) : (
                        <DSText variant="caption" tint={next ? t.card : t.mute} style={{ fontWeight: "700" }}>
                          {index + 1}
                        </DSText>
                      )}
                    </View>
                    {index < stops.length - 1 ? (
                      <View style={{ width: 1.5, height: 30, backgroundColor: done ? t.ok : t.line, marginTop: 3 }} />
                    ) : null}
                  </View>
                  <View style={{ flex: 1, gap: 2, paddingTop: 2 }}>
                    <DSText variant="bodyMedium" tint={next ? t.blue : t.ink}>{stop.name}</DSText>
                    <DSText variant="caption">
                      {stop.eta || "ETA pending"}{stop.landmark ? ` · ${stop.landmark}` : ""}
                    </DSText>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4, paddingTop: 2 }}>
                    {saved != null ? (
                      <Badge label={`${saved} students`} bg={t.okBg} fg={t.ok} />
                    ) : (
                      <DSText variant="caption" tint={next ? t.blue : t.mute}>{next ? "Next" : "Pending"}</DSText>
                    )}
                    <DSText variant="caption" tint={t.blue}>Edit</DSText>
                  </View>
                </PressableScale>
              );
            })}
          </View>
        </SectionCard>

        <SectionCard heading="GPS QUALITY">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TonalTile bg={accuracy != null && accuracy <= 50 ? t.okBg : t.warnBg} size={42}>
              <Icon
                name={accuracy != null && accuracy <= 50 ? "gps-fixed" : "gps-not-fixed"}
                size={22}
                tint={accuracy != null && accuracy <= 50 ? t.ok : t.warn}
              />
            </TonalTile>
            <View style={{ flex: 1, gap: 2 }}>
              <DSText variant="bodyMedium">
                {accuracy == null ? "No GPS fix yet" : accuracy <= 50 ? "Good GPS accuracy" : "Approximate GPS accuracy"}
              </DSText>
              <DSText variant="caption">
                {accuracy == null
                  ? "Enable location and start a journey."
                  : `±${accuracy}m · last update ${location.lastFixAt ? `${Math.max(0, Math.round((now - location.lastFixAt) / 1000))}s ago` : "unknown"}`}
              </DSText>
            </View>
          </View>
        </SectionCard>

        <PillButton
          label="Correct a stop count"
          icon="edit"
          bg={t.tint}
          fg={t.blue}
          block
          onPress={() => {
            const first = stops.find((stop) => journey.counts[stop.id] != null) ?? stops[0];
            if (first) openCount(first);
          }}
        />
      </ScrollView>

      <BottomSheet
        visible={selected != null}
        title={selected ? selected.name : "Stop count"}
        onClose={() => setSelected(null)}
        primaryLabel="Save correction"
        onPrimary={() => { void saveCount(); }}
      >
        <View style={{ alignItems: "center", gap: space.md }}>
          <DSText variant="label" style={{ textAlign: "center" }}>
            {journey.mode === "morning" ? "Students picked up" : "Students dropped"}
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
            Corrections are audited in production. Zero is allowed.
          </DSText>
        </View>
      </BottomSheet>
    </>
  );
}
