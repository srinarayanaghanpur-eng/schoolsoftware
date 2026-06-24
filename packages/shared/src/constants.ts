import type { SchoolSettings } from "./types/models";

export const ATTENDANCE_COLORS = {
  present: "bg-emerald-500 text-white",
  late: "bg-amber-400 text-slate-950",
  cl: "bg-rose-500 text-white",
  holiday: "bg-white text-slate-700 border border-slate-200",
  absent: "bg-slate-500 text-white",
  not_marked: "bg-slate-200 text-slate-700"
} as const;

export const DEFAULT_SETTINGS: SchoolSettings = {
  schoolName: "SRI NARAYANA HIGH SCHOOL",
  campusLatitude: 18.30639479001936,
  campusLongitude: 79.88312064907495,
  geofenceRadiusMeters: 150,
  schoolStartTime: "09:00",
  graceMinutes: 10,
  salaryRules: {
    lateDeductionMode: "after_3_lates_one_day",
    fixedLateDeductionAmount: 100,
    afterLateCountDeductDays: 3,
    manualDeductionDefault: 0,
    bonusDefault: 0
  },
  timezone: "Asia/Kolkata"
};
