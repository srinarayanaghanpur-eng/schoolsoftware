"use client";

import { memo } from "react";

function numericValue(item: Record<string, number | string>, key: string) {
  const value = item[key];
  return typeof value === "number" ? value : Number(value || 0);
}

function AttendanceTrendChartInner({ data }: { data: Array<Record<string, number | string>> }) {
  const max = Math.max(1, ...data.flatMap((item) => [numericValue(item, "present"), numericValue(item, "late"), numericValue(item, "absent")]));

  return (
    <div className="flex h-[260px] items-end gap-3 overflow-x-auto rounded-xl bg-stone-50 p-4">
      {data.map((item) => {
        const day = String(item.day ?? "");
        const present = numericValue(item, "present");
        const late = numericValue(item, "late");
        const absent = numericValue(item, "absent");

        return (
          <div key={day} className="flex min-w-12 flex-1 flex-col items-center justify-end gap-2">
            <div className="flex h-[190px] items-end gap-1">
              <span className="w-3 rounded-t bg-emerald-700" style={{ height: `${Math.max(6, (present / max) * 190)}px` }} title={`Present: ${present}`} />
              <span className="w-3 rounded-t bg-amber-500" style={{ height: `${Math.max(6, (late / max) * 190)}px` }} title={`Late: ${late}`} />
              <span className="w-3 rounded-t bg-slate-500" style={{ height: `${Math.max(6, (absent / max) * 190)}px` }} title={`Absent: ${absent}`} />
            </div>
            <span className="text-xs font-semibold text-stone-500">{day}</span>
          </div>
        );
      })}
    </div>
  );
}

export const AttendanceTrendChart = memo(AttendanceTrendChartInner);

function SalaryTrendChartInner({ data }: { data: Array<Record<string, number | string>> }) {
  const values = data.map((item) => numericValue(item, "payable"));
  const max = Math.max(1, ...values);
  const width = 520;
  const height = 210;
  const points = values.map((value, index) => {
    const x = values.length <= 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - (value / max) * (height - 24) - 12;
    return { x, y, value, label: String(data[index]?.month ?? "") };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return (
    <div className="h-[260px] rounded-xl bg-stone-50 p-4">
      <svg className="h-[220px] w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Salary payable trend">
        <path d={path} fill="none" stroke="#047857" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {points.map((point) => (
          <circle key={`${point.label}-${point.value}`} cx={point.x} cy={point.y} r="5" fill="#233128" />
        ))}
      </svg>
      <div className="grid grid-flow-col justify-between gap-3 text-xs font-semibold text-stone-500">
        {points.map((point) => (
          <span key={point.label}>{point.label}</span>
        ))}
      </div>
    </div>
  );
}

export const SalaryTrendChart = memo(SalaryTrendChartInner);

function TeacherPieChartInner({ present, late, absent }: { present: number; late: number; absent: number }) {
  const total = Math.max(1, present + late + absent);
  const presentPct = Math.round((present / total) * 100);
  const latePct = Math.round((late / total) * 100);

  return (
    <div className="grid h-[220px] place-items-center">
      <div className="relative grid h-40 w-40 place-items-center rounded-full" style={{ background: `conic-gradient(#047857 0 ${presentPct}%, #f59e0b ${presentPct}% ${presentPct + latePct}%, #64748b ${presentPct + latePct}% 100%)` }}>
        <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center shadow-inner">
          <span className="text-2xl font-extrabold text-stone-900">{presentPct}%</span>
          <span className="-mt-4 text-xs font-semibold text-stone-500">Present</span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs font-semibold text-stone-600">
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-700" />Present {present}</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />Late {late}</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-slate-500" />Absent {absent}</span>
      </div>
    </div>
  );
}

export const TeacherPieChart = memo(TeacherPieChartInner);
