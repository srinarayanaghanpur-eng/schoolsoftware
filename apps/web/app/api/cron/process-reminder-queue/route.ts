import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { errorMessage, requireAdmin } from "@/lib/apiUtils";
import { cleanPhoneNumber, getChannelFromPriority } from "@/lib/reminder/messageBuilder";
import { sendWhatsAppReminder } from "@/lib/reminder/whatsappProvider";
import { sendSmsReminder } from "@/lib/reminder/smsProvider";

const MAX_PER_RUN = 5;

async function sendOnChannel(
  item: Record<string, unknown>,
  channel: "whatsapp" | "sms",
  settings: Record<string, unknown>
) {
  if (channel === "whatsapp") {
    const cleaned = cleanPhoneNumber(String(item.parentMobile || ""));
    const to = cleaned.length === 10 ? `91${cleaned}` : cleaned;
    return sendWhatsAppReminder({
      to,
      templateName: "fee_reminder",
      variables: {
        parentName: String(item.parentName || ""),
        studentName: String(item.studentName || ""),
        className: String(item.className || ""),
        dueAmount: String(item.dueAmount || "0")
      },
      apiKey: String(settings.whatsappApiKey || ""),
      phoneNumberId: String(settings.whatsappPhoneNumberId || "")
    });
  }

  const to = cleanPhoneNumber(String(item.parentMobile || ""));
  return sendSmsReminder({
    to,
    message: String(item.message || ""),
    apiUrl: String(settings.smsApiUrl || ""),
    apiKey: String(settings.smsApiKey || ""),
    senderId: String(settings.smsSenderId || ""),
    dltPeId: String(settings.dltPeId || ""),
    dltHeaderId: String(settings.dltHeaderId || ""),
    dltTemplateId: String(settings.dltTemplateId || "")
  });
}

/**
 * Auth: this endpoint sends real WhatsApp/SMS messages, so it must never be
 * publicly callable. Allowed callers:
 *  1. An external scheduler presenting `x-cron-secret` matching CRON_SECRET.
 *  2. A signed-in admin (manual "run now" from the fee-reminders UI).
 */
async function isAuthorizedCronCall(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("x-cron-secret") === secret) return true;
  return Boolean(await requireAdmin(req));
}

export async function PUT(req: Request) {
  try {
    if (!(await isAuthorizedCronCall(req))) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const db = adminDb();
    const settingsSnap = await db.collection("fee_reminder_settings")
      .where("enabled", "==", true)
      .get();

    if (settingsSnap.empty) {
      return NextResponse.json({ ok: true, processed: 0, sent: 0, failed: 0 });
    }

    let totalProcessed = 0;
    let totalSent = 0;
    let totalFailed = 0;

    for (const settingsDoc of settingsSnap.docs) {
      if (totalProcessed >= MAX_PER_RUN) break;

      const settings = settingsDoc.data() as Record<string, unknown>;
      const channelInfo = getChannelFromPriority(
        String(settings.channelPriority || ""),
        "whatsapp",
        "sms"
      );

      const queueSnap = await db.collection("fee_reminder_queue")
        .where("status", "==", "pending")
        .limit(10)
        .get();

      const pendingItems = queueSnap.docs.slice(0, Math.min(queueSnap.docs.length, MAX_PER_RUN - totalProcessed));

      for (const doc of pendingItems) {
        if (totalProcessed >= MAX_PER_RUN) break;

        const item = { id: doc.id, ...doc.data() } as Record<string, unknown>;

        const seenByAnother = doc.data().status !== "pending";
        if (seenByAnother) continue;

        await db.collection("fee_reminder_queue").doc(doc.id).update({
          status: "processing",
          updatedAt: FieldValue.serverTimestamp()
        });

        let sent = false;
        let usedChannel = "";
        let providerMessageId = "";
        let lastError = "";

        const primaryResult = await sendOnChannel(item, channelInfo.primary, settings);
        totalProcessed++;
        usedChannel = channelInfo.primary;

        if (primaryResult.success) {
          sent = true;
          providerMessageId = primaryResult.providerMessageId;
        } else {
          lastError = primaryResult.errorMessage;
          if (channelInfo.fallback) {
            const fallbackResult = await sendOnChannel(item, channelInfo.fallback, settings);
            usedChannel = channelInfo.fallback;

            if (fallbackResult.success) {
              sent = true;
              providerMessageId = fallbackResult.providerMessageId;
              lastError = "";
            } else {
              lastError = fallbackResult.errorMessage;
            }
          }
        }

        const serverTimestamp = FieldValue.serverTimestamp();
        await db.collection("fee_reminder_logs").add({
          queueId: doc.id,
          studentId: String(item.studentId || ""),
          parentMobile: String(item.parentMobile || ""),
          channel: usedChannel,
          message: String(item.message || ""),
          status: sent ? "sent" : "failed",
          providerMessageId,
          providerResponse: sent ? "" : lastError,
          errorMessage: lastError,
          sentAt: sent ? serverTimestamp : null,
          createdAt: serverTimestamp,
          sentBy: "automatic_agent"
        });

        await db.collection("fee_reminder_queue").doc(doc.id).update({
          status: sent ? "sent" : "failed",
          channel: usedChannel,
          providerMessageId,
          sentAt: sent ? FieldValue.serverTimestamp() : "",
          attempts: FieldValue.increment(1),
          reason: sent ? "" : lastError,
          updatedAt: FieldValue.serverTimestamp()
        });

        if (sent) totalSent++;
        else totalFailed++;
      }
    }

    return NextResponse.json({
      ok: true,
      processed: totalProcessed,
      sent: totalSent,
      failed: totalFailed
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 400 });
  }
}
