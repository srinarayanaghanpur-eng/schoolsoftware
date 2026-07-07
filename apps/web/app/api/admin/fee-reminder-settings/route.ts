import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc } from "@/lib/apiUtils";
import { getSchoolId } from "@/lib/schoolScope";
import { logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";

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
  supportPhone: "",
};

export async function GET(req: Request) {
  const token = await requirePermission(req, "fee_reminders.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const schoolId = getSchoolId(token);
    const db = adminDb();
    const snapshot = await db.collection(COLLECTION).where("schoolId", "==", schoolId).limit(1).get();
    logFirestoreRead("FeeReminderSettingsAPI", COLLECTION, snapshot, { schoolId });

    if (snapshot.empty) {
      return NextResponse.json({
        ok: true,
        settings: { ...DEFAULT_SETTINGS, schoolId, createdAt: null, updatedAt: null },
      });
    }

    const doc = snapshot.docs[0];
    const settings = serializeDoc(doc);
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load fee reminder settings";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  const token = await requirePermission(req, "fee_reminders.manage_settings");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const body = await req.json();
    const schoolId = getSchoolId(token);
    const db = adminDb();
    const now = FieldValue.serverTimestamp();

    const existing = await db.collection(COLLECTION).where("schoolId", "==", schoolId).limit(1).get();

    const data = {
      enabled: Boolean(body.enabled),
      dailyTime: String(body.dailyTime ?? DEFAULT_SETTINGS.dailyTime),
      channelPriority: String(body.channelPriority ?? DEFAULT_SETTINGS.channelPriority),
      minimumDueAmount: Number(body.minimumDueAmount ?? DEFAULT_SETTINGS.minimumDueAmount),
      maxPerStudentPerMonth: Number(body.maxPerStudentPerMonth ?? DEFAULT_SETTINGS.maxPerStudentPerMonth),
      skipHolidays: Boolean(body.skipHolidays ?? DEFAULT_SETTINGS.skipHolidays),
      optInRequired: Boolean(body.optInRequired ?? DEFAULT_SETTINGS.optInRequired),
      retryEnabled: Boolean(body.retryEnabled ?? DEFAULT_SETTINGS.retryEnabled),
      retryCount: Number(body.retryCount ?? DEFAULT_SETTINGS.retryCount),
      retryDelayMinutes: Number(body.retryDelayMinutes ?? DEFAULT_SETTINGS.retryDelayMinutes),
      whatsappEnabled: Boolean(body.whatsappEnabled ?? DEFAULT_SETTINGS.whatsappEnabled),
      smsEnabled: Boolean(body.smsEnabled ?? DEFAULT_SETTINGS.smsEnabled),
      smsFallbackEnabled: Boolean(body.smsFallbackEnabled ?? DEFAULT_SETTINGS.smsFallbackEnabled),
      messageTemplate: String(body.messageTemplate ?? DEFAULT_SETTINGS.messageTemplate),
      whatsappApiKey: String(body.whatsappApiKey ?? DEFAULT_SETTINGS.whatsappApiKey),
      whatsappPhoneNumberId: String(body.whatsappPhoneNumberId ?? DEFAULT_SETTINGS.whatsappPhoneNumberId),
      whatsappBusinessAccountId: String(body.whatsappBusinessAccountId ?? DEFAULT_SETTINGS.whatsappBusinessAccountId),
      smsApiUrl: String(body.smsApiUrl ?? DEFAULT_SETTINGS.smsApiUrl),
      smsApiKey: String(body.smsApiKey ?? DEFAULT_SETTINGS.smsApiKey),
      smsSenderId: String(body.smsSenderId ?? DEFAULT_SETTINGS.smsSenderId),
      dltPeId: String(body.dltPeId ?? DEFAULT_SETTINGS.dltPeId),
      dltHeaderId: String(body.dltHeaderId ?? DEFAULT_SETTINGS.dltHeaderId),
      dltTemplateId: String(body.dltTemplateId ?? DEFAULT_SETTINGS.dltTemplateId),
      schoolName: String(body.schoolName ?? DEFAULT_SETTINGS.schoolName),
      supportPhone: String(body.supportPhone ?? DEFAULT_SETTINGS.supportPhone),
      updatedAt: now,
    };

    if (existing.empty) {
      const ref = await db.collection(COLLECTION).add({
        ...data,
        schoolId,
        createdAt: now,
      });
      return NextResponse.json({ ok: true, id: ref.id, message: "Settings created." });
    }

    await existing.docs[0].ref.update(data);
    return NextResponse.json({ ok: true, id: existing.docs[0].id, message: "Settings updated." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update fee reminder settings";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
