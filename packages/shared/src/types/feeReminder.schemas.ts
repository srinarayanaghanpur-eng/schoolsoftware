import { z } from "zod";

export const reminderChannelSchema = z.enum(["whatsapp", "sms"]);

export const reminderQueueStatusSchema = z.enum([
  "pending", "processing", "sent", "failed", "skipped", "duplicate"
]);

export const reminderChannelPrioritySchema = z.enum([
  "whatsapp_first_sms_fallback",
  "sms_first_whatsapp_fallback",
  "whatsapp_only",
  "sms_only"
]);

export const feeReminderSettingsCreateSchema = z.object({
  enabled: z.boolean().optional().default(false),
  dailyTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm format").optional().default("09:00"),
  channelPriority: reminderChannelPrioritySchema.optional().default("whatsapp_first_sms_fallback"),
  minimumDueAmount: z.coerce.number().nonnegative().optional().default(0),
  maxPerStudentPerMonth: z.coerce.number().int().positive().optional().default(4),
  skipHolidays: z.boolean().optional().default(true),
  optInRequired: z.boolean().optional().default(true),
  retryEnabled: z.boolean().optional().default(true),
  retryCount: z.coerce.number().int().nonnegative().optional().default(3),
  retryDelayMinutes: z.coerce.number().int().positive().optional().default(5),
  whatsappEnabled: z.boolean().optional().default(false),
  smsEnabled: z.boolean().optional().default(false),
  smsFallbackEnabled: z.boolean().optional().default(true),
  messageTemplate: z.string().optional().default(""),
  whatsappApiKey: z.string().optional().default(""),
  whatsappPhoneNumberId: z.string().optional().default(""),
  whatsappBusinessAccountId: z.string().optional().default(""),
  smsApiUrl: z.string().optional().default(""),
  smsApiKey: z.string().optional().default(""),
  smsSenderId: z.string().optional().default(""),
  dltPeId: z.string().optional().default(""),
  dltHeaderId: z.string().optional().default(""),
  dltTemplateId: z.string().optional().default(""),
  schoolName: z.string().optional().default("Sri Narayana High School"),
  supportPhone: z.string().optional().default("")
});

export const feeReminderSettingsUpdateSchema = feeReminderSettingsCreateSchema.partial();

export const feeReminderTestSendSchema = z.object({
  studentId: z.string().min(1),
  channel: reminderChannelSchema.optional().default("whatsapp"),
  academicYearId: z.string().optional().default("")
});

export const feeReminderDryRunSchema = z.object({
  academicYearId: z.string().optional().default(""),
  classFilter: z.string().optional().default(""),
  sectionFilter: z.string().optional().default("")
});
