import { parentStudentLinkSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, json } from "@/lib/apiUtils";
import { linkParentToStudent, unlinkParentFromStudent, getStudentsForParent } from "@/lib/parentStudentLink";
import { writeAuditLog } from "@/lib/auditLog";

export async function GET(req: Request, { params }: { params: { parentId: string } }) {
  try {
    const decodedToken = await requirePermission(req, "parents.view");
    if (!decodedToken) {
      return json({ ok: false, error: "Missing or insufficient permissions." }, { status: 403 });
    }

    const links = await getStudentsForParent(params.parentId);
    const studentIds = links.map((l) => l.studentId);

    let students: Record<string, unknown>[] = [];
    if (studentIds.length > 0) {
      const db = adminDb();
      const chunkSize = 30;
      for (let i = 0; i < studentIds.length; i += chunkSize) {
        const chunk = studentIds.slice(i, i + chunkSize);
        const snap = await db.collection("students").where("__name__", "in", chunk).get();
        students.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    }

    return json({ ok: true, links, students });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch links";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(req: Request, { params }: { params: { parentId: string } }) {
  try {
    const decodedToken = await requirePermission(req, "parents.edit");
    if (!decodedToken) {
      return json({ ok: false, error: "Missing or insufficient permissions." }, { status: 403 });
    }

    const body = await req.json();
    const parsed = parentStudentLinkSchema.parse({ ...body, parentUid: params.parentId });

    // No duplicate links for the same parent+student pair.
    const db = adminDb();
    const dupe = await db.collection("parent_student_links")
      .where("parentUid", "==", parsed.parentUid)
      .where("studentId", "==", parsed.studentId)
      .limit(1)
      .get()
      .catch(() => null);
    if (dupe && !dupe.empty) {
      return json({ ok: false, error: "This student is already linked to this parent" }, { status: 409 });
    }

    const id = await linkParentToStudent(parsed.parentUid, parsed.studentId, parsed.relationship, parsed.isPrimary);

    await writeAuditLog({
      action: "parent_link.created",
      entityType: "parent_student_link",
      entityId: id,
      actorId: decodedToken.uid,
      actorRole: decodedToken.role as string,
      newValues: parsed as unknown as Record<string, unknown>
    });

    return json({ ok: true, id, message: "Student linked to parent." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to link student";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: { parentId: string } }) {
  try {
    const decodedToken = await requirePermission(req, "parents.edit");
    if (!decodedToken) {
      return json({ ok: false, error: "Missing or insufficient permissions." }, { status: 403 });
    }

    const url = new URL(req.url);
    const linkId = url.searchParams.get("linkId");
    if (!linkId) {
      return json({ ok: false, error: "linkId query param required" }, { status: 400 });
    }

    // Ownership check: only delete links that belong to this parent.
    const linkSnap = await adminDb().collection("parent_student_links").doc(linkId).get();
    if (!linkSnap.exists) {
      return json({ ok: false, error: "Link not found" }, { status: 404 });
    }
    if ((linkSnap.data() as Record<string, unknown>)?.parentUid !== params.parentId) {
      return json({ ok: false, error: "Link does not belong to this parent" }, { status: 403 });
    }

    await unlinkParentFromStudent(linkId);

    await writeAuditLog({
      action: "parent_link.deleted",
      entityType: "parent_student_link",
      entityId: linkId,
      actorId: decodedToken.uid,
      actorRole: decodedToken.role as string
    });

    return json({ ok: true, message: "Link removed." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to remove link";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

