/**
 * Reference widgets (school-dashboards-v2.html): progress ring, bar chart,
 * month attendance calendar. Theme-aware, data-driven, no fake content —
 * every value comes from props.
 */
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { DSText } from "./components";
import { useTheme } from "@/lib/Theme";

/* ---------------------------------------------------------- Progress ring */

export function ProgressRing({
  progress,
  size = 150,
  children
}: {
  /** 0..1 filled fraction. */
  progress: number;
  size?: number;
  children?: React.ReactNode;
}) {
  const { t } = useTheme();
  const clamped = Math.max(0, Math.min(1, progress));
  const r = 62;
  const c = 2 * Math.PI * r;
  // viewBox units scale to `size` via width/height.
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center", alignSelf: "center" }}>
      <Svg width={size} height={size} viewBox="0 0 150 150" style={{ position: "absolute" }}>
        <Circle cx={75} cy={75} r={r} fill="none" stroke={t.line} strokeWidth={10} />
        <Circle
          cx={75}
          cy={75}
          r={r}
          fill="none"
          stroke={t.blue}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          transform="rotate(-90 75 75)"
        />
      </Svg>
      {children}
    </View>
  );
}

/* -------------------------------------------------------------- Bar chart */

export type BarDatum = { label: string; value: number; highlight?: boolean };

export function BarChart({ data, height = 92 }: { data: BarDatum[]; height?: number }) {
  const { t } = useTheme();
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={[styles.bars, { height }]}>
      {data.map((datum) => (
        <View key={datum.label} style={styles.barCol}>
          <View
              style={[
                styles.bar,
                {
                  height: Math.max(4, Math.round((datum.value / max) * (height - 22))),
                  backgroundColor: datum.highlight ? "#FFFFFF" : "rgba(255,255,255,0.35)"
                }
              ]}
            />
          <DSText style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>{datum.label}</DSText>
        </View>
      ))}
    </View>
  );
}

/* -------------------------------------------------------- Month calendar */

export type DayMark = "P" | "A" | "L";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function MonthCalendar({
  year,
  month,
  marks,
  today
}: {
  /** Full year, e.g. 2026. */
  year: number;
  /** 1-12. */
  month: number;
  /** Day-of-month -> mark. */
  marks: Record<number, DayMark>;
  /** Day-of-month highlighted as today (optional). */
  today?: number;
}) {
  const { t } = useTheme();
  const cells = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    // Monday-first offset.
    const lead = (first.getDay() + 6) % 7;
    const days = new Date(year, month, 0).getDate();
    const list: Array<{ day: number } | null> = [];
    for (let i = 0; i < lead; i += 1) list.push(null);
    for (let d = 1; d <= days; d += 1) list.push({ day: d });
    return list;
  }, [year, month]);

  const markStyle = (mark: DayMark | undefined) => {
    if (mark === "P") return { backgroundColor: t.okBg, color: t.ok };
    if (mark === "A") return { backgroundColor: t.badBg, color: t.bad };
    if (mark === "L") return { backgroundColor: t.warnBg, color: t.warn };
    return null;
  };

  return (
    <View>
      <View style={styles.calGrid}>
        {WEEKDAYS.map((day, index) => (
          <DSText key={`${day}-${index}`} style={styles.calHead}>
            {day}
          </DSText>
        ))}
        {cells.map((cell, index) => {
          if (!cell) return <View key={`blank-${index}`} />;
          const mark = marks[cell.day];
          const styled = markStyle(mark);
          const isToday = today === cell.day;
          return (
            <View
              key={cell.day}
              style={[
                styles.calCell,
                styled ? { backgroundColor: styled.backgroundColor } : null,
                isToday ? { borderWidth: 2, borderColor: t.blue } : null
              ]}
            >
              <DSText style={[{ fontSize: 12, fontWeight: "600" }, styled ? { color: styled.color } : null]}>
                {cell.day}
              </DSText>
            </View>
          );
        })}
      </View>
      <View style={styles.legend}>
        {(
          [
            ["Present", t.ok],
            ["Absent", t.bad],
            ["Leave", t.warn]
          ] as Array<[string, string]>
        ).map(([label, swatch]) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: swatch }]} />
            <DSText variant="label">{label}</DSText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 14 },
  barCol: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 6, height: "100%" },
  bar: { width: "100%", borderTopLeftRadius: 6, borderTopRightRadius: 6, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  calGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  calHead: { fontSize: 10, width: "12%", textAlign: "center" },
  calCell: {
    width: "12%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10
  },
  legend: { flexDirection: "row", gap: 14, marginTop: 14 },
  legendItem: { flexDirection: "row", alignItems: "center" },
  dot: { width: 8, height: 8, borderRadius: 3, marginRight: 5 }
});
