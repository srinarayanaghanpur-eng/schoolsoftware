import { errorMessage, requirePermission, json } from "@/lib/apiUtils";
import { markDebitVouchersPrinted } from "@/lib/debitVoucherService";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
    const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string") : [params.id];
    await markDebitVouchersPrinted(ids.length ? ids : [params.id]);
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Unable to update print status") }, { status: 400 });
  }
}

