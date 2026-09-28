"use client";

import { AttendanceTrendChart, SalaryTrendChart, TeacherPieChart } from "@/components/Charts";

export function LazyAttendanceTrendChart({ data }: { data: Array<Record<string, number | string>> }) {
  return <AttendanceTrendChart data={data} />;
}

export function LazySalaryTrendChart({ data }: { data: Array<Record<string, number | string>> }) {
  return <SalaryTrendChart data={data} />;
}

export function LazyTeacherPieChart({ present, late, absent }: { present: number; late: number; absent: number }) {
  return <TeacherPieChart present={present} late={late} absent={absent} />;
}
