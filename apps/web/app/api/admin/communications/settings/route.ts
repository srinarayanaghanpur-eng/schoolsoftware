import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { errorMessage, json, requirePermission } from "@/lib/apiUtils";
import { getSchoolId } from "@/lib/schoolScope";
import { desktopOnly } from "@/lib/desktopGate";
import {
  DEFAULT_COMMUNICATION_SETTINGS,
  keepSecret,
  maskCommunicationSettings,
  normalizeCommunicationSettings,
  SMS_PROVIDERS,
  type CommunicationSettings
} from "@/lib/communications";

const COLLECTION = "communication_settings";
const DOC_ID = "default";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requirePermission(req, "communication.view");
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const desktopError = desktopOnly(req);
  if (desktopError) return desktopError;

  try {
    const snap = await adminDb().collection(COLLECTION).doc(DOC_ID).get();
    const settings = normalizeCommunicationSettings(snap.exists ? snap.data() : DEFAULT_COMMUNICATION_SETTINGS);
    return json({ ok: true, settings: maskCommunicationSettings(settings), providers: SMS_PROVIDERS });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Unable to load communication settings") }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = await requirePermission(req, "communication.edit");
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const desktopError = desktopOnly(req);
  if (desktopError) return desktopError;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const ref = adminDb().collection(COLLECTION).doc(DOC_ID);
    const snap = await ref.get();
    const stored = normalizeCommunicationSettings(snap.exists ? snap.data() : DEFAULT_COMMUNICATION_SETTINGS);
    const incoming = normalizeCommunicationSettings(body);
    const next: CommunicationSettings = {
      ...incoming,
      smsApiKey: keepSecret(body.smsApiKey, stored.smsApiKey),
      whatsappToken: keepSecret(body.whatsappToken, stored.whatsappToken)
    };
    await ref.set(
      {
        ...next,
        schoolId: getSchoolId(auth),
        updatedBy: auth.uid,
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    return json({ ok: true, settings: maskCommunicationSettings(next) });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Unable to save communication settings") }, { status: 400 });
  }
}
