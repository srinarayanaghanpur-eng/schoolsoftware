import { requirePermission, json } from "@/lib/apiUtils";
import { buildAdmissionDocx, getAdmissionDocData } from "@/lib/admissionDocx";

// GET /api/admin/admission-form/[id]/docx — filled admission DOCX download.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(_req, "students.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const data = await getAdmissionDocData(params.id);
    const buffer = await buildAdmissionDocx(data, new Date());
    const filename = `Admission-${data.admissionNo || params.id}.docx`;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length)
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate document";
    const status = message === "Student not found" ? 404 : 500;
    return json({ ok: false, error: message }, { status });
  }
}
