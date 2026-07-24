export const REMINDER_CHANNELS = ["whatsapp", "sms"] as const;
export type ReminderChannel = (typeof REMINDER_CHANNELS)[number];

export const REMINDER_QUEUE_STATUSES = ["pending", "processing", "sent", "failed", "skipped", "duplicate"] as const;
export type ReminderQueueStatus = (typeof REMINDER_QUEUE_STATUSES)[number];

export const REMINDER_CHANNEL_PRIORITIES = [
  "whatsapp_first_sms_fallback",
  "sms_first_whatsapp_fallback",
  "whatsapp_only",
  "sms_only"
] as const;
export type ReminderChannelPriority = (typeof REMINDER_CHANNEL_PRIORITIES)[number];

export type FeeReminderSettings = {
  id: string;
  schoolId: string;
  enabled: boolean;
  dailyTime: string; // HH:mm
  channelPriority: ReminderChannelPriority;
  minimumDueAmount: number;
  maxPerStudentPerMonth: number;
  skipHolidays: boolean;
  optInRequired: boolean;
  retryEnabled: boolean;
  retryCount: number;
  retryDelayMinutes: number;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
  smsFallbackEnabled: boolean;
  messageTemplate: string;
  whatsappApiKey: string;
  whatsappPhoneNumberId: string;
  whatsappBusinessAccountId: string;
  smsApiUrl: string;
  smsApiKey: string;
  smsSenderId: string;
  dltPeId: string;
  dltHeaderId: string;
  dltTemplateId: string;
  schoolName: string;
  supportPhone: string;
  createdAt: string;
  updatedAt: string;
};

export type FeeReminderQueueItem = {
  id: string;
  studentId: string;
  parentName: string;
  parentMobile: string;
  alternateMobile: string;
  className: string;
  section: string;
  studentName: string;
  admissionNumber: string;
  feeType: string;
  dueAmount: number;
  feeBreakup: FeeBreakupItem[];
  totalDue: number;
  message: string;
  channel: ReminderChannel;
  status: ReminderQueueStatus;
  reason: string;
  attempts: number;
  providerMessageId: string;
  scheduledAt: string;
  sentAt: string;
  createdAt: string;
  updatedAt: string;
  academicYearId: string;
  schoolId: string;
};

export type FeeBreakupItem = {
  feeType: string;
  dueAmount: number;
};

export type FeeReminderLog = {
  id: string;
  queueId: string;
  studentId: string;
  parentMobile: string;
  channel: ReminderChannel;
  message: string;
  status: ReminderQueueStatus;
  providerMessageId: string;
  providerResponse: string;
  errorMessage: string;
  sentAt: string;
  createdAt: string;
  sentBy: string; // "automatic_agent" | "manual"
};

export type StudentReminderConsent = {
  studentId: string;
  parentMobile: string;
  whatsappOptIn: boolean;
  smsOptIn: boolean;
  optedInAt: string;
  optedOutAt: string;
  source: "admission_form" | "manual" | "online_form";
};

export type FeeReminderDashboardStats = {
  totalDueStudents: number;
  totalDueAmount: number;
  remindersSentToday: number;
  remindersFailedToday: number;
  classWiseDue: ClassWiseDue[];
  feeTypeWiseDue: FeeTypeWiseDue[];
  channelWiseReport: ChannelWiseReport;
  deliveryStatusReport: DeliveryStatusReport;
  remindersPending: number;
  remindersProcessing: number;
};

export type ClassWiseDue = {
  className: string;
  section: string;
  studentCount: number;
  totalDue: number;
};

export type FeeTypeWiseDue = {
  feeType: string;
  totalDue: number;
  studentCount: number;
};

export type ChannelWiseReport = {
  whatsapp: { sent: number; failed: number };
  sms: { sent: number; failed: number };
};

export type DeliveryStatusReport = {
  sent: number;
  failed: number;
  pending: number;
  skipped: number;
  duplicate: number;
};
