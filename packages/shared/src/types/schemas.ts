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
  employmentType: z.enum(["full_time", "part_time_morning", "part_time_afternoon"]).optional().default("full_time"),
  allowedCLPerMonth: z.coerce.number().int().min(0).optional().default(3),
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

// ===== Phase 2 schemas =====
export const examTypeSchema = z.enum(["unit_test", "midterm", "final", "olympiad", "other"]);

export const examTimetableEntrySchema = z.object({
  subject: z.string().trim().min(1),
  date: z.string().trim().min(8),
  time: z.string().trim().min(1),
  maxMarks: z.coerce.number().positive().optional()
});

export const examCreateSchema = z.object({
  name: z.string().trim().min(1),
  academicYearId: z.string().trim().min(1),
  className: z.string().trim().min(1),
  section: z.string().trim().optional().default(""),
  examType: examTypeSchema,
  startDate: z.string().trim().min(8),
  endDate: z.string().trim().optional().default(""),
  maxMarks: z.coerce.number().positive(),
  timetable: z.array(examTimetableEntrySchema).optional().default([]),
  status: z.enum(["scheduled", "ongoing", "completed", "published"]).optional().default("scheduled")
});

export const examMarkEntrySchema = z.object({
  studentId: z.string().trim().min(1),
  subject: z.string().trim().min(1),
  marksObtained: z.coerce.number().min(0),
  maxMarks: z.coerce.number().positive(),
  grade: z.string().trim().optional().default(""),
  remarks: z.string().trim().optional().default("")
});

export const examMarksBulkSchema = z.object({
  marks: z.array(examMarkEntrySchema).min(1)
});

export const noticeChannelSchema = z.enum(["app", "sms", "whatsapp", "email"]);
export const noticeCategorySchema = z.enum(["school", "branch", "class", "holiday", "exam", "event", "fee", "emergency"]);

export const noticeCreateSchema = z.object({
  title: z.string().trim().min(1),
  body: z.string().trim().min(1),
  category: noticeCategorySchema.optional().default("school"),
  audienceRoles: z.array(z.string()).optional().default([]),
  audienceClasses: z.array(z.string()).optional().default([]),
  branch: z.string().trim().optional().default(""),
  channels: z.array(noticeChannelSchema).optional().default(["app"]),
  academicYearId: z.string().trim().optional().default("")
});

// ===== Phase 3 schemas =====
export const feeHeadSchema = z.object({
  name: z.string().trim().min(1),
  amount: z.coerce.number().nonnegative()
});

export const feeStructureCreateSchema = z.object({
  academicYearId: z.string().trim().min(1),
  className: z.string().trim().min(1),
  heads: z.array(feeHeadSchema).min(1)
});

export const paymentOrderSchema = z.object({
  studentId: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  paymentType: z.string().trim().optional().default("tuition"),
  note: z.string().trim().optional().default("")
});

export const paymentConfirmSchema = z.object({
  orderId: z.string().trim().min(1),
  transactionId: z.string().trim().optional().default(""),
  method: z.string().trim().optional().default("online")
});

export const userStudentsLinkSchema = z.object({
  studentIds: z.array(z.string().trim().min(1))
});

// ===== Finance schemas =====
export const financePaymentMethodSchema = z.enum(["cash", "bank", "upi", "cheque", "card", "other"]);

export const expenseCreateSchema = z.object({
  category: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  date: z.string().trim().min(8),
  description: z.string().trim().min(1),
  vendor: z.string().trim().optional().default(""),
  paymentMethod: financePaymentMethodSchema.optional().default("cash"),
  academicYearId: z.string().trim().optional().default("")
});

export const expenseStatusUpdateSchema = z.object({
  status: z.enum(["approved", "rejected"])
});

export const incomeCreateSchema = z.object({
  category: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  date: z.string().trim().min(8),
  description: z.string().trim().min(1),
  source: z.string().trim().optional().default(""),
  paymentMethod: financePaymentMethodSchema.optional().default("cash"),
  academicYearId: z.string().trim().optional().default("")
});

export const salaryAdvanceCreateSchema = z.object({
  teacherId: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  date: z.string().trim().min(8),
  reason: z.string().trim().optional().default("")
});

// ===== Finance (vendors/purchases/banking/invoices) schemas =====
export const vendorCreateSchema = z.object({
  name: z.string().trim().min(1),
  contact: z.string().trim().optional().default(""),
  phone: z.string().trim().optional().default(""),
  address: z.string().trim().optional().default(""),
  gstin: z.string().trim().optional().default("")
});

export const purchaseItemSchema = z.object({
  name: z.string().trim().min(1),
  qty: z.coerce.number().positive(),
  rate: z.coerce.number().nonnegative()
});

export const purchaseCreateSchema = z.object({
  vendorId: z.string().trim().min(1),
  billNo: z.string().trim().optional().default(""),
  date: z.string().trim().min(8),
  items: z.array(purchaseItemSchema).optional().default([]),
  amount: z.coerce.number().positive(),
  category: z.string().trim().optional().default("")
});

export const purchasePaySchema = z.object({
  amount: z.coerce.number().positive(),
  method: z.string().trim().optional().default("cash")
});

export const bankAccountCreateSchema = z.object({
  name: z.string().trim().min(1),
  bankName: z.string().trim().optional().default(""),
  accountNumber: z.string().trim().optional().default(""),
  openingBalance: z.coerce.number().optional().default(0)
});

export const bankTxnSchema = z.object({
  type: z.enum(["deposit", "withdrawal", "transfer"]),
  amount: z.coerce.number().positive(),
  date: z.string().trim().min(8),
  description: z.string().trim().optional().default(""),
  toAccountId: z.string().trim().optional().default("")
});

// ===== Installment schemas =====
export const installmentSchema = z.object({
  number: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive(),
  dueDate: z.string().trim().min(8),
  status: z.enum(["pending", "paid", "overdue", "cancelled"]).optional().default("pending"),
  paidDate: z.string().trim().optional().default(""),
  paymentId: z.string().trim().optional().default("")
});

export const installmentPlanCreateSchema = z.object({
  studentId: z.string().trim().min(1),
  totalAmount: z.coerce.number().positive(),
  installments: z.array(installmentSchema).min(1),
  academicYearId: z.string().trim().min(1)
});

export const invoiceItemSchema = z.object({ name: z.string().trim().min(1), amount: z.coerce.number().nonnegative() });
export const invoiceCreateSchema = z.object({
  studentId: z.string().trim().min(1),
  items: z.array(invoiceItemSchema).min(1),
  date: z.string().trim().optional().default("")
});

// ===== Phase 4 schemas =====
export const vehicleCreateSchema = z.object({ regNo: z.string().trim().min(1), model: z.string().trim().optional().default(""), capacity: z.coerce.number().int().positive(), driverName: z.string().trim().optional().default(""), driverPhone: z.string().trim().optional().default("") });
export const routeStopSchema = z.object({ name: z.string().trim().min(1), fee: z.coerce.number().nonnegative() });
export const transportRouteCreateSchema = z.object({ name: z.string().trim().min(1), vehicleId: z.string().trim().optional().default(""), stops: z.array(routeStopSchema).min(1) });
export const transportAssignmentSchema = z.object({ studentId: z.string().trim().min(1), routeId: z.string().trim().min(1), stopName: z.string().trim().min(1), fee: z.coerce.number().nonnegative() });

export const bookCreateSchema = z.object({ title: z.string().trim().min(1), author: z.string().trim().optional().default(""), isbn: z.string().trim().optional().default(""), category: z.string().trim().optional().default(""), copies: z.coerce.number().int().positive() });
export const libraryIssueSchema = z.object({ bookId: z.string().trim().min(1), memberType: z.enum(["student", "staff"]), memberId: z.string().trim().min(1), memberName: z.string().trim().optional().default(""), dueDate: z.string().trim().min(8) });
export const libraryReturnSchema = z.object({ fine: z.coerce.number().nonnegative().optional().default(0) });

export const hostelRoomCreateSchema = z.object({ number: z.string().trim().min(1), type: z.string().trim().optional().default(""), capacity: z.coerce.number().int().positive() });
export const hostelAllotmentSchema = z.object({ studentId: z.string().trim().min(1), roomId: z.string().trim().min(1), fromDate: z.string().trim().min(8) });

export const inventoryItemCreateSchema = z.object({ name: z.string().trim().min(1), category: z.string().trim().optional().default(""), stock: z.coerce.number().int().nonnegative(), unitPrice: z.coerce.number().nonnegative() });
export const inventorySaleSchema = z.object({ itemId: z.string().trim().min(1), qty: z.coerce.number().int().positive(), buyer: z.string().trim().optional().default(""), date: z.string().trim().optional().default("") });

// ===== Phase 4: Promotion =====
export const promotionTypeSchema = z.enum(["promote", "detain", "section_change"]);

export const promotionCreateSchema = z.object({
  promotionType: promotionTypeSchema,
  academicYearId: z.string().trim().min(1, "Target academic year is required"),
  studentIds: z.array(z.string().trim().min(1)).min(1, "At least one student must be selected"),
  fromClass: z.string().trim().min(1),
  fromSection: z.string().trim().optional().default(""),
  toClass: z.string().trim().optional().default(""),
  toSection: z.string().trim().optional().default(""),
  feeBalanceCarryForward: z.boolean().optional().default(false),
  requireApproval: z.boolean().optional().default(false),
  notes: z.string().trim().optional().default("")
});

// ===== Phase 0: Audit Log =====
export const auditLogSchema = z.object({
  action: z.string().trim().min(1),
  entityType: z.string().trim().min(1),
  entityId: z.string().trim().min(1),
  actorId: z.string().trim().min(1),
  actorRole: z.string().trim().min(1),
  oldValues: z.record(z.unknown()).optional().default({}),
  newValues: z.record(z.unknown()).optional().default({}),
  reason: z.string().trim().optional().default(""),
  branch: z.string().trim().optional().default(""),
  deviceInfo: z.string().trim().optional().default(""),
  ipAddress: z.string().trim().optional().default(""),
  approvalId: z.string().trim().optional().default(""),
  academicYearId: z.string().trim().optional().default("")
});

// ===== Phase 0: Approval Workflow =====
export const approvalRequestCreateSchema = z.object({
  requestType: z.string().trim().min(1),
  entityType: z.string().trim().min(1),
  entityId: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().optional().default(""),
  payload: z.record(z.unknown()).optional().default({}),
  branch: z.string().trim().optional().default(""),
  academicYearId: z.string().trim().optional().default("")
});

export const approvalRequestReviewSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  notes: z.string().trim().optional().default("")
});

// ===== Phase 0: Parent–Student Link =====
export const parentStudentLinkSchema = z.object({
  parentUid: z.string().trim().min(1),
  studentId: z.string().trim().min(1),
  relationship: z.enum(["father", "mother", "guardian", "other"]),
  isPrimary: z.boolean().optional().default(false)
});

// ===== Parent Account Management =====
export const parentCreateSchema = z.object({
  fullName: z.string().trim().min(2, "Name must be at least 2 characters"),
  phone: z.string().trim().min(10, "Phone must be at least 10 digits"),
  loginId: z.string().trim().min(3, "Login ID must be at least 3 characters"),
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Confirm password must be at least 8 characters")
}).refine((value) => value.password === value.confirmPassword, {
  message: "Password and confirm password must match",
  path: ["confirmPassword"]
});

export const parentUpdateSchema = z.object({
  fullName: z.string().trim().min(2).optional(),
  phone: z.string().trim().min(10).optional(),
  email: z.string().email().optional().or(z.literal(""))
});

// ===== Parent Messages =====
export const parentMessageTypeSchema = z.enum(["enquiry", "support_ticket", "complaint", "meeting_request"]);
export const parentMessageStatusSchema = z.enum(["open", "in_progress", "resolved"]);

export const parentMessageCreateSchema = z.object({
  parentUid: z.string().trim().min(1),
  studentId: z.string().trim().min(1),
  type: parentMessageTypeSchema,
  subject: z.string().trim().min(1, "Subject is required"),
  body: z.string().trim().min(1, "Message body is required")
});

export const parentMessageReplySchema = z.object({
  status: parentMessageStatusSchema,
  reply: z.string().trim().min(1, "Reply is required")
});

// ===== Fee Reminder =====
export const feeReminderCreateSchema = z.object({
  studentId: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  dueDate: z.string().trim().min(8),
  note: z.string().trim().optional().default("")
});
