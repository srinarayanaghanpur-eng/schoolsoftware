import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebaseAdmin";
import { enforceBodyLimit, errorMessage, json, requirePermission } from "@/lib/apiUtils";
import { checkRateLimit } from "@/lib/quota/rateLimiter";
import { getSchoolId } from "@/lib/schoolScope";
import { desktopOnly } from "@/lib/desktopGate";
import {
  DEFAULT_COMMUNICATION_SETTINGS,
  maskPhone,
  normalizeCommunicationSettings,
  normalizePhone,
  toWhatsAppNumber,
  type CommunicationSettings
} from "@/lib/communications";

const LOGS = "communication_logs";

const payloadSchema = z.object({
  channel: z.enum(["sms", "whatsapp"]),
  message: z.string().trim().min(1).max(1000),
  recipients: z
    .array(
      z.object({
        name: z.string().trim().max(160).optional().default(""),
        phone: z.string().trim().min(6).max(20),
        studentId: z.string().trim().max(150).optional().default("")
      })
    )
    .min(1)
    .max(100)
});

type RecipientResult = { phone: string; name: string; ok: boolean; error?: string };

async function sendSms(settings: CommunicationSettings, to: string, message: string) {
  if (!settings.smsApiUrl || !settings.smsApiKey) {
    throw new Error("SMS gateway URL / API key is not configured");
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  let body: Record<string, unknown>;

  if (settings.smsProvider === "msg91") {
    headers.authkey = settings.smsApiKey;
    body = {
      sender: settings.smsSenderId,
      route: "4",
      country: "91",
      sms: [{ message, to: [to] }]
    };
  } else if (settings.smsProvider === "ctrlshiftm") {
    body = {
      api_key: settings.smsApiKey,
      sender_id: settings.smsSenderId,
      template_id: settings.smsTemplateId,
      mobile: to,
      message
    };
  } else {
    body = {
      apiKey: settings.smsApiKey,
      senderId: settings.smsSenderId,
      templateId: settings.smsTemplateId,
      to,
      number: to,
      message
    };
  }

  const res = await fetch(settings.smsApiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gateway responded ${res.status}${text ? `: ${text.slice(0, 160)}` : ""}`);
  }
}

async function sendWhatsApp(settings: CommunicationSettings, to: string, message: string) {
  if (!settings.whatsappToken || !settings.whatsappPhoneNumberId) {
    throw new Error("WhatsApp Cloud API token / phone number ID is not configured");
  }

  const body = settings.whatsappTemplateName
    ? {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: settings.whatsappTemplateName,
          language: { code: settings.whatsappLanguage || "en" },
          components: [{ type: "body", parameters: [{ type: "text", text: message }] }]
        }
      }
    : {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message }
      };

  const res = await fetch(`https://graph.facebook.com/v19.0/${settings.whatsappPhoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.whatsappToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`WhatsApp responded ${res.status}${text ? `: ${text.slice(0, 160)}` : ""}`);
  }
}

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requirePermission(req, "communication.create");
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const desktopError = desktopOnly(req);
  if (desktopError) return desktopError;

  const limit = await checkRateLimit({ key: `communication-send:${auth.uid}`, maxRequests: 10, windowMinutes: 1 });
  if (!limit.allowed) return json({ ok: false, error: "Too many send attempts. Try again in a minute." }, { status: 429 });

  const bodyLimit = enforceBodyLimit(req, 48 * 1024);
  if (bodyLimit) return bodyLimit;

  try {
    const parsed = payloadSchema.parse(await req.json());
    const settingsSnap = await adminDb().collection("communication_settings").doc("default").get();
    const settings = normalizeCommunicationSettings(
      settingsSnap.exists ? settingsSnap.data() : DEFAULT_COMMUNICATION_SETTINGS
    );

    if (parsed.channel === "sms" && !settings.smsEnabled) {
      return json({ ok: false, error: "SMS is disabled in Communication → Gateway." }, { status: 400 });
    }
    if (parsed.channel === "whatsapp" && !settings.whatsappEnabled) {
      return json({ ok: false, error: "WhatsApp auto-send is disabled in Communication → Gateway." }, { status: 400 });
    }

    const results: RecipientResult[] = [];
    for (const recipient of parsed.recipients) {
      const name = recipient.name || "";
      try {
        if (parsed.channel === "sms") {
          const phone = normalizePhone(recipient.phone);
          if (phone.length < 10) throw new Error("Invalid phone number");
          await sendSms(settings, phone.length === 10 ? `91${phone}` : phone, parsed.message);
          results.push({ phone: maskPhone(recipient.phone), name, ok: true });
        } else {
          const phone = toWhatsAppNumber(recipient.phone);
          if (phone.length < 10) throw new Error("Invalid phone number");
          await sendWhatsApp(settings, phone, parsed.message);
          results.push({ phone: maskPhone(recipient.phone), name, ok: true });
        }
      } catch (error) {
        results.push({
          phone: maskPhone(recipient.phone),
          name,
          ok: false,
          error: errorMessage(error, "Send failed")
        });
      }
    }

    const sent = results.filter((item) => item.ok).length;
    const failed = results.length - sent;

    await adminDb()
      .collection(LOGS)
      .add({
        channel: parsed.channel,
        message: parsed.message,
        total: results.length,
        sent,
        failed,
        results,
        schoolId: getSchoolId(auth),
        sentBy: auth.uid,
        sentByName: String(auth.name || auth.email || ""),
        createdAt: FieldValue.serverTimestamp()
      });

    return json({ ok: failed === 0, channel: parsed.channel, total: results.length, sent, failed, results });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Unable to send messages") }, { status: 400 });
  }
}
