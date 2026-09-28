"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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
