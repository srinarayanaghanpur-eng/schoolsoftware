import { NextResponse } from "next/server";
import { parentStudentLinkSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { linkParentToStudent, unlinkParentFromStudent, getStudentsForParent } from "@/lib/parentStudentLink";
import { writeAuditLog } from "@/lib/auditLog";

export async function GET(req: Request, { params }: { params: { parentId: string } }) {
  try {
    const decodedToken = await requirePermission(req, "parents.view");
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Missing or insufficient permissions." }, { status: 403 });
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

    return NextResponse.json({ ok: true, links, students });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch links";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(req: Request, { params }: { params: { parentId: string } }) {
  try {
    const decodedToken = await requirePermission(req, "parents.edit");
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Missing or insufficient permissions." }, { status: 403 });
    }

    const body = await req.json();
    const parsed = parentStudentLinkSchema.parse({ ...body, parentUid: params.parentId });

    const id = await linkParentToStudent(parsed.parentUid, parsed.studentId, parsed.relationship, parsed.isPrimary);

    await writeAuditLog({
      action: "parent_link.created",
      entityType: "parent_student_link",
      entityId: id,
      actorId: decodedToken.uid,
      actorRole: decodedToken.role as string,
      newValues: parsed as unknown as Record<string, unknown>
    });

    return NextResponse.json({ ok: true, id, message: "Student linked to parent." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to link student";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: { parentId: string } }) {
  try {
    const decodedToken = await requirePermission(req, "parents.edit");
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Missing or insufficient permissions." }, { status: 403 });
    }

    const url = new URL(req.url);
    const linkId = url.searchParams.get("linkId");
    if (!linkId) {
      return NextResponse.json({ ok: false, error: "linkId query param required" }, { status: 400 });
    }

    await unlinkParentFromStudent(linkId);

    await writeAuditLog({
      action: "parent_link.deleted",
      entityType: "parent_student_link",
      entityId: linkId,
      actorId: decodedToken.uid,
      actorRole: decodedToken.role as string
    });

    return NextResponse.json({ ok: true, message: "Link removed." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to remove link";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
