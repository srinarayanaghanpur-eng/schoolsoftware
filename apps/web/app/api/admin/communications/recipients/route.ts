import { adminDb } from "@/lib/firebaseAdmin";
import { errorMessage, json, requirePermission } from "@/lib/apiUtils";
import { normalizePhone } from "@/lib/communications";

export const dynamic = "force-dynamic";

type StudentRow = {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  section: string;
  phone: string;
};

/**
 * GET /api/admin/communications/recipients?class=6&section=A
 * Returns active students with a usable phone number for bulk messaging.
 */
export async function GET(req: Request) {
  const auth = await requirePermission(req, "communication.view");
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const className = String(searchParams.get("class") || "").trim();
  const section = String(searchParams.get("section") || "").trim();

  try {
    let query: FirebaseFirestore.Query = adminDb().collection("students");
    if (className) query = query.where("class", "==", className);
    if (className && section) query = query.where("section", "==", section);

    const snap = await query.limit(400).get();
    const recipients: StudentRow[] = snap.docs
      .map((doc) => {
        const data = doc.data() as Record<string, unknown>;
        const phone = String(data.phone || data.fatherPhone || data.motherPhone || "");
        return {
          studentId: doc.id,
          studentName: String(data.studentName || data.name || ""),
          admissionNumber: String(data.admissionNumber || ""),
          className: String(data.class || ""),
          section: String(data.section || ""),
          phone
        };
      })
      .filter((row) => row.studentName && normalizePhone(row.phone).length >= 10 && row.admissionNumber !== undefined)
      .sort((a, b) => a.studentName.localeCompare(b.studentName));

    return json({ ok: true, recipients });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Unable to load recipients") }, { status: 500 });
  }
}
