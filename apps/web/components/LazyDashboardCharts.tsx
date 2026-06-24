"use client";

import dynamic from "next/dynamic";

const chartFallback = <div className="grid h-[260px] place-items-center rounded-xl bg-stone-50 text-sm text-stone-500">Loading chart...</div>;

const pieFallback = <div className="grid h-[220px] place-items-center rounded-xl bg-stone-50 text-sm text-stone-500">Loading chart...</div>;

const AttendanceTrendChart = dynamic(() => import("@/components/Charts").then((module) => module.AttendanceTrendChart), {
  loading: () => chartFallback
});

const SalaryTrendChart = dynamic(() => import("@/components/Charts").then((module) => module.SalaryTrendChart), {
  loading: () => chartFallback
});

const TeacherPieChart = dynamic(() => import("@/components/Charts").then((module) => module.TeacherPieChart), {
  loading: () => pieFallback
});

export function LazyAttendanceTrendChart({ data }: { data: Array<Record<string, number | string>> }) {
  return <AttendanceTrendChart data={data} />;
}

export function LazySalaryTrendChart({ data }: { data: Array<Record<string, number | string>> }) {
  return <SalaryTrendChart data={data} />;
}

export function LazyTeacherPieChart({ present, late, absent }: { present: number; late: number; absent: number }) {
  return <TeacherPieChart present={present} late={late} absent={absent} />;
}
