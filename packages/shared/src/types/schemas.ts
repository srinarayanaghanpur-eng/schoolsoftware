import { z } from "zod";

export const attendanceEventTypeSchema = z.enum(["checkin", "checkout"]);
export const attendanceSourceSchema = z.enum(["mobile", "biometric", "admin", "system"]);
export const verificationTypeSchema = z.enum(["face", "fingerprint", "card", "pin", "unknown"]);
export const attendanceStatusSchema = z.enum(["present", "late", "cl", "holiday", "absent", "not_marked"]);
export const requestStatusSchema = z.enum(["open", "resolved", "rejected"]);
export const leaveRequestStatusSchema = z.enum(["pending", "approved", "rejected"]);

export const mobileAttendancePayloadSchema = z.object({
  teacherId: z.string().min(1),
  eventType: attendanceEventTypeSchema,
  timestamp: z.string().datetime(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  accuracyMeters: z.number().optional(),
  deviceInfo: z.string().min(1)
});

export const biometricPayloadSchema = z.object({
  deviceId: z.string().min(1),
  biometricUserId: z.string().min(1),
  timestamp: z.string(),
  verificationType: verificationTypeSchema,
  eventType: attendanceEventTypeSchema
});

export const academicYearCreateSchema = z.object({
  name: z.string().trim().min(4), // e.g. "2026-27"
  startDate: z.string().trim().min(8),
  endDate: z.string().trim().min(8),
  isActive: z.boolean().optional().default(false)
});

const teacherBaseSchema = z.object({
  fullName: z.string().trim().min(2),
  phone: z.string().trim().optional().default(""),
  subject: z.string().trim().min(2),
  employeeId: z.string().trim().min(1),
  biometricUserId: z.string().trim().optional().default(""),
  baseSalary: z.coerce.number().nonnegative(),
  joiningDate: z.string().trim().optional().default(""),
  status: z.enum(["active", "inactive"]),
  allowedCLPerMonth: z.coerce.number().int().min(0).optional().default(2),
  lateDeductionRule: z.enum(["none", "half_day", "fixed", "after_3_lates_one_day"]).optional().default("after_3_lates_one_day")
});

export const teacherFormSchema = teacherBaseSchema;

export const teacherLoginCreateSchema = teacherFormSchema
  .extend({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm password must be at least 8 characters")
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Password and confirm password must match",
    path: ["confirmPassword"]
  });

export const teacherLoginUpdateSchema = teacherBaseSchema.extend({
  joiningDate: z.string().trim().optional(),
  allowedCLPerMonth: z.coerce.number().int().min(0).optional(),
  lateDeductionRule: z.enum(["none", "half_day", "fixed", "after_3_lates_one_day"]).optional()
});

export const passwordResetSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm password must be at least 8 characters")
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Password and confirm password must match",
    path: ["confirmPassword"]
  });

export const passwordResetRequestCreateSchema = z.object({
  loginId: z.string().trim().min(1, "Employee ID or Admin ID is required")
});

export const passwordResetRequestUpdateSchema = z.object({
  status: requestStatusSchema,
  adminNote: z.string().trim().optional().default("")
});

export const leaveRequestCreateSchema = z
  .object({
    startDate: z.string().trim().min(1),
    endDate: z.string().trim().min(1),
    reason: z.string().trim().min(3, "Leave reason is required")
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "End date must be after start date",
    path: ["endDate"]
  });

export const leaveRequestReviewSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  adminNote: z.string().trim().optional().default("")
});

export const attendanceEditSchema = z.object({
  attendanceId: z.string().trim().min(1),
  teacherId: z.string().trim().min(1),
  date: z.string().trim().min(1),
  status: attendanceStatusSchema,
  checkInTime: z.string().trim().optional().default(""),
  checkOutTime: z.string().trim().optional().default(""),
  lateMinutes: z.coerce.number().int().min(0).optional().default(0),
  remarks: z.string().trim().optional().default(""),
  reason: z.string().trim().min(3, "Audit reason is required")
});
