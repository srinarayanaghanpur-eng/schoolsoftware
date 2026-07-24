import { parentStudentLinkSchema } from "@sri-narayana/shared";
import { requireAdmin, json } from "@/lib/apiUtils";
import { linkParentToStudent, getStudentsForParent } from "@/lib/parentStudentLink";
import { writeAuditLog } from "@/lib/auditLog";

export async function GET(req: Request) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const url = new URL(req.url);
    const parentUid = url.searchParams.get("parentUid");
    const studentId = url.searchParams.get("studentId");

    if (parentUid) {
      const links = await getStudentsForParent(parentUid);
      return json({ ok: true, links });
    }

    return json({ ok: false, error: "Provide parentUid or studentId query param" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch links";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = parentStudentLinkSchema.parse(body);

    const id = await linkParentToStudent(
      parsed.parentUid,
      parsed.studentId,
      parsed.relationship,
      parsed.isPrimary
    );

    await writeAuditLog({
      action: "parent_link.created",
      entityType: "parent_student_link",
      entityId: id,
      actorId: decodedToken.uid,
      actorRole: decodedToken.role as string,
      newValues: parsed as unknown as Record<string, unknown>
    });

    return json({ ok: true, id, message: "Parent linked to student." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to link parent to student";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

