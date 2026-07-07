import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { aiLog } from "@/lib/ai/aiLogger";
import { AI_PERMISSIONS } from "@/lib/ai/aiPermissions";
import { getSchoolId } from "@/lib/schoolScope";
import { FEE_REMINDER_TEMPLATE } from "@/lib/ai/aiPrompts";
import { checkQuotaBeforeOp, safeGetDoc, safeGetDocs } from "@/lib/quota/firebaseQuotaGuard";
import { getCachedResponse, setCachedResponse, getCacheTtlForFeature } from "@/lib/quota/cacheManager";

export async function POST(req: Request) {
  try {
    const token = await requirePermission(req, AI_PERMISSIONS.GENERATE_FEE_MESSAGE);
    if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

    const body = await req.json();
    const { studentId } = body;

    if (!studentId) {
      return NextResponse.json({ ok: false, error: "Student ID is required" }, { status: 400 });
    }

    const schoolId = getSchoolId(token);
    const db = adminDb();

    const fbQuota = await checkQuotaBeforeOp(schoolId, 3);
    if (!fbQuota.allowed) {
      return NextResponse.json({
        ok: false,
        error: fbQuota.message || "Firebase quota protection active.",
        mode: fbQuota.mode,
      }, { status: 429 });
    }

    const studentSnap = await db.collection("students").doc(studentId).get();
    if (!studentSnap.exists) {
      return NextResponse.json({ ok: false, error: "Student not found" }, { status: 404 });
    }

    const student = studentSnap.data() as Record<string, unknown>;
    const studentName = String(student.studentName || student.name || "");
    const parentName = String(student.parentName || student.parent_name || "");
    const className = String(student.class || student.className || "");
    const section = String(student.section || "");
    const sectionText = section ? ` - ${section}` : "";
    const parentMobile = String(student.parentMobile || student.mobile || "");
    const hasConsent = Boolean(student.smsConsent || student.whatsappConsent);

    const dueSnap = await db.collection("fee_dues")
      .where("studentId", "==", studentId)
      .where("status", "==", "pending")
      .limit(25)
      .get();

    if (dueSnap.empty) {
      return NextResponse.json({ ok: false, error: "No pending dues found for this student." }, { status: 404 });
    }

    let totalDue = 0;
    const feeTypeDetails: Array<{ feeType: string; amount: number }> = [];

    dueSnap.forEach((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const amount = Number(data.amount || data.dueAmount || 0);
      const feeType = String(data.feeType || data.feeHead || "Fee");
      totalDue += amount;
      feeTypeDetails.push({ feeType, amount });
    });

    const warnings: string[] = [];
    if (!parentMobile) {
      warnings.push("Parent mobile number not available. Cannot send SMS/WhatsApp.");
    }
    if (!hasConsent) {
      warnings.push("SMS/WhatsApp consent not given. Cannot send automatic messages.");
    }

    let message = "";

    if (feeTypeDetails.length > 1) {
      message = `Dear ${parentName},\n\nThis is a fee reminder from Sri Narayana High School.\nFee due for ${studentName} of Class ${className}${sectionText}:\n\n`;
      feeTypeDetails.forEach(({ feeType, amount }) => {
        message += `${feeType}: Rs ${amount}\n`;
      });
      message += `\nTotal Due: Rs ${totalDue}\n\nKindly clear the due amount as early as possible.\n\nThank you,\nSri Narayana High School`;
    } else {
      message = FEE_REMINDER_TEMPLATE
        .replace("{{parentName}}", parentName)
        .replace("{{studentName}}", studentName)
        .replace("{{className}}", className)
        .replace("{{sectionText}}", sectionText)
        .replace("{{dueAmount}}", String(totalDue))
        .replace("{{feeType}}", feeTypeDetails[0]?.feeType || "Fee");
    }

    const variables = {
      studentName,
      parentName,
      className,
      section,
      totalDue,
      feeTypes: feeTypeDetails.map((f) => f.feeType),
      parentMobile,
      hasConsent,
    };

    await aiLog({
      schoolId,
      userId: token.uid,
      userName: token.name as string || "Unknown",
      role: token.role as string || "unknown",
      feature: "fee_reminder",
      promptType: "generate_fee_message",
      inputPreview: `Generate fee message for student ${studentId}`,
      outputPreview: message.slice(0, 500),
      status: "success",
    });

    return NextResponse.json({
      ok: true,
      message,
      variables,
      warnings: warnings.length > 0 ? warnings : undefined,
      totalDue,
      note: "Generated using fixed template. No Gemini request used.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate fee message";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
