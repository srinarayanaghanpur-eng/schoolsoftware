import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc, json } from "@/lib/apiUtils";
import { getSchoolId } from "@/lib/schoolScope";
import { logFirestoreRead } from "@/lib/firestoreReadLogger";

const COLLECTION = "fee_reminder_settings";

const DEFAULT_SETTINGS: Record<string, unknown> = {
  enabled: false,
  dailyTime: "09:00",
  channelPriority: "whatsapp_first_sms_fallback",
  minimumDueAmount: 100,
  maxPerStudentPerMonth: 4,
  skipHolidays: true,
  optInRequired: true,
  retryEnabled: true,
  retryCount: 3,
  retryDelayMinutes: 30,
  whatsappEnabled: true,
  smsEnabled: true,
  smsFallbackEnabled: true,
  smsProvider: "dlt",
  messageTemplate: "Dear {{parentName}}, fee of Rs.{{amount}} is due for {{studentName}} ({{className}}). Due date: {{dueDate}}. Pay via: {{paymentLink}}",
  whatsappApiKey: "",
  whatsappPhoneNumberId: "",
  whatsappBusinessAccountId: "",
  smsApiUrl: "",
  smsApiKey: "",
  smsSenderId: "",
  dltPeId: "",
  dltHeaderId: "",
  dltTemplateId: "",
  schoolName: "",
  supportPhone: ""
};

// Sentinel returned to the client instead of real provider API keys. It renders
// naturally as dots in the password inputs, and PUT treats it (or "") as
// "keep the stored value", so a load→save round-trip never corrupts the key.
const MASKED_KEY = "********";

function maskKey(value: unknown): string {
  return String(value ?? "") ? MASKED_KEY : "";
}

function keepExistingKey(incoming: unknown, stored: unknown): string {
  const value = String(incoming ?? "");
  if (value === "" || value === MASKED_KEY) return String(stored ?? "");
  return value;
}

function normalizeSettings(raw: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const source = raw ?? {};
  const has = (key: string) => Object.prototype.hasOwnProperty.call(source, key);
  return {
    ...DEFAULT_SETTINGS,
    ...source,
    enabled: has("enabled") ? Boolean(source.enabled) : Boolean(DEFAULT_SETTINGS.enabled),
    dailyTime: String(source.dailyTime ?? DEFAULT_SETTINGS.dailyTime),
    channelPriority: String(source.channelPriority ?? DEFAULT_SETTINGS.channelPriority),
    minimumDueAmount: Number(source.minimumDueAmount ?? DEFAULT_SETTINGS.minimumDueAmount),
    maxPerStudentPerMonth: Number(source.maxPerStudentPerMonth ?? DEFAULT_SETTINGS.maxPerStudentPerMonth),
    skipHolidays: has("skipHolidays") ? Boolean(source.skipHolidays) : Boolean(DEFAULT_SETTINGS.skipHolidays),
    optInRequired: has("optInRequired") ? Boolean(source.optInRequired) : Boolean(DEFAULT_SETTINGS.optInRequired),
    retryEnabled: has("retryEnabled") ? Boolean(source.retryEnabled) : Boolean(DEFAULT_SETTINGS.retryEnabled),
    retryCount: Number(source.retryCount ?? DEFAULT_SETTINGS.retryCount),
    retryDelayMinutes: Number(source.retryDelayMinutes ?? DEFAULT_SETTINGS.retryDelayMinutes),
    whatsappEnabled: has("whatsappEnabled") ? Boolean(source.whatsappEnabled) : Boolean(DEFAULT_SETTINGS.whatsappEnabled),
    smsEnabled: has("smsEnabled") ? Boolean(source.smsEnabled) : Boolean(DEFAULT_SETTINGS.smsEnabled),
    smsFallbackEnabled: has("smsFallbackEnabled") ? Boolean(source.smsFallbackEnabled) : Boolean(DEFAULT_SETTINGS.smsFallbackEnabled),
    smsProvider: String(source.smsProvider ?? DEFAULT_SETTINGS.smsProvider),
    messageTemplate: String(source.messageTemplate ?? DEFAULT_SETTINGS.messageTemplate),
    whatsappApiKey: String(source.whatsappApiKey ?? ""),
    whatsappPhoneNumberId: String(source.whatsappPhoneNumberId ?? ""),
    whatsappBusinessAccountId: String(source.whatsappBusinessAccountId ?? ""),
    smsApiUrl: String(source.smsApiUrl ?? ""),
    smsApiKey: String(source.smsApiKey ?? ""),
    smsSenderId: String(source.smsSenderId ?? ""),
    dltPeId: String(source.dltPeId ?? ""),
    dltHeaderId: String(source.dltHeaderId ?? ""),
    dltTemplateId: String(source.dltTemplateId ?? ""),
    schoolName: String(source.schoolName ?? ""),
    supportPhone: String(source.supportPhone ?? "")
  };
}

/**
 * The stored document uses flat keys because the reminder queue reads them
 * directly. The admin screen is grouped into sections, so expose a nested
 * shape there and keep one canonical storage format.
 */
function toClientSettings(raw: Record<string, unknown>) {
  const s = normalizeSettings(raw);
  return {
    general: {
      enabled: Boolean(s.enabled),
      reminderTime: String(s.dailyTime),
      channelPriority: String(s.channelPriority),
      minimumDueAmount: Number(s.minimumDueAmount),
      maxRemindersPerMonth: Number(s.maxPerStudentPerMonth),
      skipHolidays: Boolean(s.skipHolidays),
      optInRequired: Boolean(s.optInRequired)
    },
    retry: {
      enabled: Boolean(s.retryEnabled),
      retryCount: Number(s.retryCount),
      retryDelayMinutes: Number(s.retryDelayMinutes)
    },
    whatsapp: {
      enabled: Boolean(s.whatsappEnabled),
      apiKey: maskKey(s.whatsappApiKey),
      phoneNumberId: String(s.whatsappPhoneNumberId),
      businessAccountId: String(s.whatsappBusinessAccountId)
    },
    sms: {
      enabled: Boolean(s.smsEnabled),
      provider: String(s.smsProvider || "dlt"),
      apiUrl: String(s.smsApiUrl),
      apiKey: maskKey(s.smsApiKey),
      senderId: String(s.smsSenderId),
      dltPeId: String(s.dltPeId),
      dltHeaderId: String(s.dltHeaderId),
      dltTemplateId: String(s.dltTemplateId)
    },
    schoolInfo: {
      schoolName: String(s.schoolName),
      supportPhone: String(s.supportPhone)
    }
  };
}

function clientToStored(incoming: Record<string, unknown>) {
  const general = (incoming.general ?? {}) as Record<string, unknown>;
  const retry = (incoming.retry ?? {}) as Record<string, unknown>;
  const whatsapp = (incoming.whatsapp ?? {}) as Record<string, unknown>;
  const sms = (incoming.sms ?? {}) as Record<string, unknown>;
  const schoolInfo = (incoming.schoolInfo ?? {}) as Record<string, unknown>;

  const channelPriority = String(general.channelPriority ?? incoming.channelPriority ?? DEFAULT_SETTINGS.channelPriority);
  const whatsappOnly = channelPriority === "whatsapp_only";
  const smsOnly = channelPriority === "sms_only";

  return {
    enabled: Boolean(general.enabled ?? incoming.enabled ?? false),
    dailyTime: String(general.reminderTime ?? incoming.dailyTime ?? DEFAULT_SETTINGS.dailyTime),
    channelPriority,
    minimumDueAmount: Number(general.minimumDueAmount ?? incoming.minimumDueAmount ?? DEFAULT_SETTINGS.minimumDueAmount),
    maxPerStudentPerMonth: Number(general.maxRemindersPerMonth ?? incoming.maxPerStudentPerMonth ?? DEFAULT_SETTINGS.maxPerStudentPerMonth),
    skipHolidays: Boolean(general.skipHolidays ?? incoming.skipHolidays ?? DEFAULT_SETTINGS.skipHolidays),
    optInRequired: Boolean(general.optInRequired ?? incoming.optInRequired ?? DEFAULT_SETTINGS.optInRequired),
    retryEnabled: Boolean(retry.enabled ?? incoming.retryEnabled ?? DEFAULT_SETTINGS.retryEnabled),
    retryCount: Number(retry.retryCount ?? incoming.retryCount ?? DEFAULT_SETTINGS.retryCount),
    retryDelayMinutes: Number(retry.retryDelayMinutes ?? incoming.retryDelayMinutes ?? DEFAULT_SETTINGS.retryDelayMinutes),
    whatsappEnabled: Boolean(whatsapp.enabled ?? incoming.whatsappEnabled ?? !smsOnly),
    smsEnabled: Boolean(sms.enabled ?? incoming.smsEnabled ?? !whatsappOnly),
    smsFallbackEnabled: !whatsappOnly && !smsOnly,
    smsProvider: String(sms.provider ?? incoming.smsProvider ?? DEFAULT_SETTINGS.smsProvider),
    messageTemplate: String(incoming.messageTemplate ?? DEFAULT_SETTINGS.messageTemplate),
    whatsappApiKey: String(whatsapp.apiKey ?? incoming.whatsappApiKey ?? ""),
    whatsappPhoneNumberId: String(whatsapp.phoneNumberId ?? incoming.whatsappPhoneNumberId ?? ""),
    whatsappBusinessAccountId: String(whatsapp.businessAccountId ?? incoming.whatsappBusinessAccountId ?? ""),
    smsApiUrl: String(sms.apiUrl ?? incoming.smsApiUrl ?? ""),
    smsApiKey: String(sms.apiKey ?? incoming.smsApiKey ?? ""),
    smsSenderId: String(sms.senderId ?? incoming.smsSenderId ?? ""),
    dltPeId: String(sms.dltPeId ?? incoming.dltPeId ?? ""),
    dltHeaderId: String(sms.dltHeaderId ?? incoming.dltHeaderId ?? ""),
    dltTemplateId: String(sms.dltTemplateId ?? incoming.dltTemplateId ?? ""),
    schoolName: String(schoolInfo.schoolName ?? incoming.schoolName ?? ""),
    supportPhone: String(schoolInfo.supportPhone ?? incoming.supportPhone ?? "")
  };
}

async function findSettingsDoc(schoolId: string, academicYearId: string) {
  const db = adminDb();
  if (academicYearId) {
    const scoped = await db.collection(COLLECTION)
      .where("schoolId", "==", schoolId)
      .where("academicYearId", "==", academicYearId)
      .limit(1)
      .get();
    logFirestoreRead("FeeReminderSettingsAPI", COLLECTION, scoped, { schoolId, academicYearId });
    if (!scoped.empty) return scoped.docs[0];
  }

  const school = await db.collection(COLLECTION)
    .where("schoolId", "==", schoolId)
    .limit(1)
    .get();
  logFirestoreRead("FeeReminderSettingsAPI", COLLECTION, school, { schoolId, academicYearId, legacyFallback: true });
  return school.empty ? null : school.docs[0];
}

export async function GET(req: Request) {
  const token = await requirePermission(req, "fee_reminders.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const schoolId = getSchoolId(token);
    const academicYearId = new URL(req.url).searchParams.get("academicYearId") || "";
    const doc = await findSettingsDoc(schoolId, academicYearId);

    const raw = doc
      ? serializeDoc(doc)
      : { ...DEFAULT_SETTINGS, schoolId, academicYearId, createdAt: null, updatedAt: null };

    return json({
      ok: true,
      academicYearId,
      settings: toClientSettings(raw as Record<string, unknown>)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load fee reminder settings";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  const token = await requirePermission(req, "fee_reminders.manage_settings");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const body = await req.json();
    const schoolId = getSchoolId(token);
    const incoming = (body.settings ?? body) as Record<string, unknown>;
    const academicYearId = String(body.academicYearId ?? incoming.academicYearId ?? "");
    const db = adminDb();
    const now = FieldValue.serverTimestamp();

    const existing = await findSettingsDoc(schoolId, academicYearId);
    const existingDoc = existing ? (existing.data() as Record<string, unknown>) : null;
    const stored = clientToStored(incoming);

    const data = {
      ...stored,
      academicYearId,
      schoolId,
      whatsappApiKey: keepExistingKey(
        (incoming.whatsapp as Record<string, unknown> | undefined)?.apiKey ?? incoming.whatsappApiKey,
        existingDoc?.whatsappApiKey
      ),
      smsApiKey: keepExistingKey(
        (incoming.sms as Record<string, unknown> | undefined)?.apiKey ?? incoming.smsApiKey,
        existingDoc?.smsApiKey
      ),
      updatedAt: now
    };

    if (!existing) {
      const ref = await db.collection(COLLECTION).add({
        ...data,
        createdAt: now
      });
      return json({ ok: true, id: ref.id, message: "Settings created." });
    }

    await existing.ref.update(data);
    return json({ ok: true, id: existing.id, message: "Settings updated." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update fee reminder settings";
    return json({ ok: false, error: message }, { status: 400 });
  }
}
