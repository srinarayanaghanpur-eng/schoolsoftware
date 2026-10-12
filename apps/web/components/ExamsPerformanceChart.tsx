"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

const BarChart = dynamic(() => import("recharts").then((mod) => mod.BarChart), {
  ssr: false,
  loading: () => (
    <div className="grid h-72 min-h-[280px] w-full place-items-center rounded-xl bg-muted text-sm text-muted-foreground">Loading chart...</div>
  ),
}) as unknown as ComponentType<any>;

const Bar = dynamic(() => import("recharts").then((mod) => mod.Bar), {
  ssr: false,
  loading: () => (
    <div className="grid h-72 min-h-[280px] w-full place-items-center rounded-xl bg-muted text-sm text-muted-foreground">Loading chart...</div>
  ),
}) as unknown as ComponentType<any>;

const XAxis = dynamic(() => import("recharts").then((mod) => mod.XAxis), {
  ssr: false,
  loading: () => (
    <div className="grid h-72 min-h-[280px] w-full place-items-center rounded-xl bg-muted text-sm text-muted-foreground">Loading chart...</div>
  ),
}) as unknown as ComponentType<any>;

const YAxis = dynamic(() => import("recharts").then((mod) => mod.YAxis), {
  ssr: false,
  loading: () => (
    <div className="grid h-72 min-h-[280px] w-full place-items-center rounded-xl bg-muted text-sm text-muted-foreground">Loading chart...</div>
  ),
}) as unknown as ComponentType<any>;

const CartesianGrid = dynamic(() => import("recharts").then((mod) => mod.CartesianGrid), {
  ssr: false,
  loading: () => (
    <div className="grid h-72 min-h-[280px] w-full place-items-center rounded-xl bg-muted text-sm text-muted-foreground">Loading chart...</div>
  ),
}) as unknown as ComponentType<any>;

const Tooltip = dynamic(() => import("recharts").then((mod) => mod.Tooltip), {
  ssr: false,
  loading: () => (
    <div className="grid h-72 min-h-[280px] w-full place-items-center rounded-xl bg-muted text-sm text-muted-foreground">Loading chart...</div>
  ),
}) as unknown as ComponentType<any>;

const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), {
  ssr: false,
  loading: () => (
    <div className="grid h-72 min-h-[280px] w-full place-items-center rounded-xl bg-muted text-sm text-muted-foreground">Loading chart...</div>
  ),
}) as unknown as ComponentType<any>;

type PerformanceRow = { subject: string; percentage: number };

const chartLabelColor = "hsl(var(--chart-label))";
const chartGridColor = "hsl(var(--chart-grid))";
const chartTooltipStyle = {
  border: "1px solid hsl(var(--border))",
  borderRadius: "12px",
  background: "hsl(var(--chart-tooltip))",
  color: "hsl(var(--chart-tooltip-foreground))",
  fontSize: "13px",
};
const chartTooltipTextStyle = { color: "hsl(var(--chart-tooltip-foreground))" };

export function ExamsPerformanceChart({ data }: { data: PerformanceRow[] }) {
  return (
    <div className="h-72 min-h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
          <XAxis dataKey="subject" tick={{ fontSize: 12, fill: chartLabelColor }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: chartLabelColor }} />
          <Tooltip contentStyle={chartTooltipStyle} labelStyle={chartTooltipTextStyle} itemStyle={chartTooltipTextStyle} cursor={{ fill: "hsl(var(--muted) / 0.72)" }} />
          <Bar dataKey="percentage" fill="hsl(var(--accent-number))" radius={[6, 6, 0, 0]} name="Percentage" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
