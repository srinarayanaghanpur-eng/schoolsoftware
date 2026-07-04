import type { EmploymentType, SchoolSettings } from "./types/models";

/**
 * Check-in / check-out time windows per employment type (24h "HH:MM", IST).
 * - Check-in is only allowed between checkInStart and checkInEnd.
 * - A check-in at or after lateAfter (but within the window) is marked "late".
 * - Check-out is only allowed between checkOutStart and checkOutEnd.
 */
export const ATTENDANCE_WINDOWS: Record<
  EmploymentType,
  { checkInStart: string; checkInEnd: string; lateAfter: string; checkOutStart: string; checkOutEnd: string }
> = {
  full_time: { checkInStart: "06:00", checkInEnd: "09:30", lateAfter: "09:00", checkOutStart: "16:30", checkOutEnd: "17:30" },
  part_time_morning: { checkInStart: "06:00", checkInEnd: "09:30", lateAfter: "09:00", checkOutStart: "11:30", checkOutEnd: "12:30" },
  part_time_afternoon: { checkInStart: "12:00", checkInEnd: "13:00", lateAfter: "13:00", checkOutStart: "16:30", checkOutEnd: "17:30" }
};

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: "Full-time",
  part_time_morning: "Part-time (Morning, till 12 PM)",
  part_time_afternoon: "Part-time (Afternoon, 12–5 PM)"
};

export const ATTENDANCE_COLORS = {
  present: "bg-emerald-500 text-white",
  late: "bg-amber-400 text-slate-950",
  cl: "bg-rose-500 text-white",
  holiday: "bg-white text-slate-700 border border-slate-200",
  absent: "bg-slate-500 text-white",
  not_marked: "bg-slate-200 text-slate-700"
} as const;

export const FEE_HEAD_PRESETS = [
  "Tuition Fee",
  "Transport Fee", 
  "Books & Supplies",
  "Examination Fee",
  "Hostel Fee",
  "Uniform Fee"
] as const;

/**
 * School identity/contact details shown to parents across the portal
 * (footer, contact page, receipts). Single source of truth so every
 * parent-facing surface stays consistent.
 */
export const SCHOOL_CONTACT = {
  name: "SRI NARAYANA HIGH SCHOOL",
  phone: "6300038389",
  address: "Ghanpur, Jayashankar Bhupalpally-506135"
} as const;

export const DEFAULT_SETTINGS: SchoolSettings = {
  schoolName: "SRI NARAYANA HIGH SCHOOL",
  campusLatitude: 18.30639479001936,
  campusLongitude: 79.88312064907495,
  geofenceRadiusMeters: 150,
  schoolStartTime: "09:00",
  graceMinutes: 0,
  salaryRules: {
    lateDeductionMode: "after_3_lates_one_day",
    fixedLateDeductionAmount: 100,
    afterLateCountDeductDays: 3,
    manualDeductionDefault: 0,
    bonusDefault: 0
  },
  timezone: "Asia/Kolkata"
};
