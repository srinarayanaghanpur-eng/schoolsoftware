import { FieldValue } from "firebase-admin/firestore";
import * as XLSX from "xlsx";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, enforceBodyLimit, json } from "@/lib/apiUtils";
import { markSummaryDirty } from "@/lib/markSummaryDirty";
import { getSchoolId } from "@/lib/schoolScope";

export const dynamic = "force-dynamic";

type UploadType = "fee-structures" | "transport-routes" | "book-prices" | "students";

const ROMAN: Record<string, string> = {
  I: "1", II: "2", III: "3", IV: "4", V: "5", VI: "6", VII: "7", VIII: "8", IX: "9", X: "10",
  LKG: "LKG", UKG: "UKG", NUR: "Nur", NURSERY: "Nur"
};

function normClass(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (ROMAN[upper]) return ROMAN[upper];
  return raw;
}

function normText(value: unknown): string {
  return String(value ?? "").trim();
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function rowsFromWorkbook(buffer: ArrayBuffer): Record<string, unknown>[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const first = wb.SheetNames[0];
  if (!first) throw new Error("Workbook has no sheets");
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[first], { defval: "" });
}

function pick(row: Record<string, unknown>, names: string[]): string {
  for (const key of Object.keys(row)) {
    const k = key.trim().toLowerCase();
    if (names.includes(k)) return normText(row[key]);
  }
  return "";
}

function pickNum(row: Record<string, unknown>, names: string[]): number {
  for (const key of Object.keys(row)) {
    const k = key.trim().toLowerCase();
    if (names.includes(k)) return num(row[key]);
  }
  return NaN;
}

type Summary = { created: number; updated: number; skipped: number; errors: string[] };

// POST /api/admin/settings/bulk-upload — multipart: file, type, academicYearId.
// Permission-gated (settings.bulk_upload) for Settings Manager / Super Admin.
export async function POST(req: Request) {
  const token = await requirePermission(req, "settings.bulk_upload");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  // Multipart workbook upload — cap before buffering the file into memory.
  const tooBig = enforceBodyLimit(req, 8 * 1024 * 1024);
  if (tooBig) return tooBig;

  try {
    const form = await req.formData();
    const file = form.get("file");
    const type = String(form.get("type") ?? "") as UploadType;
    const academicYearId = normText(form.get("academicYearId"));

    if (!(file instanceof Blob)) return json({ ok: false, error: "No file uploaded" }, { status: 400 });
    if (!["fee-structures", "transport-routes", "book-prices", "students"].includes(type)) {
      return json({ ok: false, error: "Unknown upload type" }, { status: 400 });
    }
    if (type !== "transport-routes" && !academicYearId) {
      return json({ ok: false, error: "Academic year is required for this upload type" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const rows = rowsFromWorkbook(buffer);
    if (rows.length === 0) return json({ ok: false, error: "File has no data rows" }, { status: 400 });
    if (rows.length > 2000) return json({ ok: false, error: "Too many rows (max 2000 per upload)" }, { status: 400 });

    const db = adminDb();
    const schoolId = getSchoolId(token);
    const summary: Summary =
      type === "fee-structures" ? await uploadFeeStructures(db, rows, academicYearId, schoolId)
      : type === "transport-routes" ? await uploadTransportRoutes(db, rows)
      : type === "book-prices" ? await uploadBookPrices(db, rows, academicYearId, schoolId)
      : await uploadStudents(db, rows, academicYearId, schoolId);

    await markSummaryDirty("settings:bulk-upload").catch(() => undefined);
    return json({ ok: true, type, ...summary });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Upload failed" }, { status: 400 });
  }
}

async function uploadFeeStructures(
  db: FirebaseFirestore.Firestore, rows: Record<string, unknown>[], academicYearId: string, schoolId: string
): Promise<Summary> {
  const summary: Summary = { created: 0, updated: 0, skipped: 0, errors: [] };
  // Class | Head | Amount → group heads per class.
  const byClass = new Map<string, { name: string; amount: number }[]>();
  rows.forEach((row, i) => {
    const cls = normClass(pick(row, ["class", "classname", "class id"]));
    const head = pick(row, ["head", "fee head", "particular", "name", "feehead"]);
    const amount = pickNum(row, ["amount", "fee", "fees", "price", "rate"]);
    if (!cls || !head || !Number.isFinite(amount) || amount < 0) {
      summary.skipped++;
      if (summary.errors.length < 10) summary.errors.push(`Row ${i + 2}: need Class, Head, Amount`);
      return;
    }
    if (!byClass.has(cls)) byClass.set(cls, []);
    byClass.get(cls)!.push({ name: head, amount });
  });

  let batch = db.batch();
  let ops = 0;
  const flush = async () => {
    if (ops > 0) await batch.commit();
    batch = db.batch();
    ops = 0;
  };
  for (const [cls, heads] of byClass) {
    const total = heads.reduce((s, h) => s + h.amount, 0);
    const existing = await db.collection("fee_structures")
      .where("academicYearId", "==", academicYearId)
      .where("className", "==", cls)
      .limit(1)
      .get();
    const doc = { academicYearId, className: cls, heads, schoolId, total, updatedAt: FieldValue.serverTimestamp() };
    if (existing.empty) {
      batch.set(db.collection("fee_structures").doc(), { ...doc, createdAt: FieldValue.serverTimestamp() });
      summary.created++;
    } else {
      batch.set(existing.docs[0].ref, doc, { merge: true });
      summary.updated++;
    }
    ops++;
    if (ops >= 400) await flush();
  }
  await flush();
  return summary;
}

async function uploadTransportRoutes(
  db: FirebaseFirestore.Firestore, rows: Record<string, unknown>[]
): Promise<Summary> {
  const summary: Summary = { created: 0, updated: 0, skipped: 0, errors: [] };
  // Route | Vehicle | Stop | Fare → group stops per route.
  const byRoute = new Map<string, { vehicleId: string; stops: { name: string; fee: number }[] }>();
  rows.forEach((row, i) => {
    const route = pick(row, ["route", "route name", "routename"]);
    const stop = pick(row, ["stop", "stop name", "village", "stopname"]);
    const fare = pickNum(row, ["fare", "fee", "amount", "price"]);
    const vehicle = pick(row, ["vehicle", "vehicle id", "vehicleid", "bus"]);
    if (!route || !stop) {
      summary.skipped++;
      if (summary.errors.length < 10) summary.errors.push(`Row ${i + 2}: need Route and Stop`);
      return;
    }
    if (!byRoute.has(route)) byRoute.set(route, { vehicleId: vehicle, stops: [] });
    const entry = byRoute.get(route)!;
    if (vehicle && !entry.vehicleId) entry.vehicleId = vehicle;
    entry.stops.push({ name: stop, fee: Number.isFinite(fare) && fare >= 0 ? fare : 0 });
  });

  let batch = db.batch();
  let ops = 0;
  for (const [route, data] of byRoute) {
    const existing = await db.collection("transport_routes").where("name", "==", route).limit(1).get();
    const doc = { name: route, vehicleId: data.vehicleId, stops: data.stops, updatedAt: FieldValue.serverTimestamp() };
    if (existing.empty) {
      batch.set(db.collection("transport_routes").doc(), { ...doc, createdAt: FieldValue.serverTimestamp() });
      summary.created++;
    } else {
      batch.set(existing.docs[0].ref, doc, { merge: true });
      summary.updated++;
    }
    ops++;
    if (ops >= 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
  return summary;
}

async function uploadBookPrices(
  db: FirebaseFirestore.Firestore, rows: Record<string, unknown>[], academicYearId: string, schoolId: string
): Promise<Summary> {
  const summary: Summary = { created: 0, updated: 0, skipped: 0, errors: [] };
  // Class | Book | Price → upsert book_prices by class + title + year.
  let batch = db.batch();
  let ops = 0;
  const flush = async () => {
    if (ops > 0) await batch.commit();
    batch = db.batch();
    ops = 0;
  };
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cls = normClass(pick(row, ["class", "classname", "class id"]));
    const title = pick(row, ["book", "title", "book name", "item", "name"]);
    const price = pickNum(row, ["price", "amount", "rate", "fee"]);
    if (!cls || !title || !Number.isFinite(price) || price < 0) {
      summary.skipped++;
      if (summary.errors.length < 10) summary.errors.push(`Row ${i + 2}: need Class, Book, Price`);
      continue;
    }
    const existing = await db.collection("book_prices")
      .where("academicYearId", "==", academicYearId)
      .where("classId", "==", cls)
      .where("titleLower", "==", title.toLowerCase())
      .limit(1)
      .get()
      .catch(() => null);
    const doc = {
      academicYearId, classId: cls, className: cls, title, titleLower: title.toLowerCase(),
      price, schoolId, updatedAt: FieldValue.serverTimestamp()
    };
    if (!existing || existing.empty) {
      batch.set(db.collection("book_prices").doc(), { ...doc, createdAt: FieldValue.serverTimestamp() });
      summary.created++;
    } else {
      batch.set(existing.docs[0].ref, doc, { merge: true });
      summary.updated++;
    }
    ops++;
    if (ops >= 200) await flush();
  }
  await flush();
  return summary;
}

async function uploadStudents(
  db: FirebaseFirestore.Firestore, rows: Record<string, unknown>[], academicYearId: string, schoolId: string
): Promise<Summary> {
  const summary: Summary = { created: 0, updated: 0, skipped: 0, errors: [] };
  // Name | Class | Section | Village | Route | Phone — mirrors single-create.
  const existingSnap = await db.collection("students").select("studentNameLower", "class").get();
  const existing = new Set(existingSnap.docs.map((d) => `${String(d.data().studentNameLower ?? "")}|${String(d.data().class ?? "")}`));
  const counterRef = db.collection("counters").doc("students");
  const counterSnap = await counterRef.get();
  let next = Number(counterSnap.data()?.nextAdmission ?? 1);
  const now = new Date();

  let batch = db.batch();
  let ops = 0;
  const flush = async () => {
    if (ops > 0) await batch.commit();
    batch = db.batch();
    ops = 0;
  };
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = pick(row, ["name", "student name", "studentname", "full name"]);
    const cls = normClass(pick(row, ["class", "classname", "class id"]));
    const section = pick(row, ["section", "sec", "division"]) || "A";
    const village = pick(row, ["village", "address", "place"]);
    const route = pick(row, ["route", "bus route"]);
    const phone = pick(row, ["phone", "mobile", "fatherphone", "father phone", "contact"]);
    if (!name || !cls) {
      summary.skipped++;
      if (summary.errors.length < 10) summary.errors.push(`Row ${i + 2}: need Name and Class`);
      continue;
    }
    if (existing.has(`${name.toLowerCase()}|${cls}`)) {
      summary.skipped++;
      continue;
    }
    existing.add(`${name.toLowerCase()}|${cls}`);
    const admissionNumber = `SNHS${String(next).padStart(3, "0")}`;
    next++;
    const ref = db.collection("students").doc();
    batch.set(ref, {
      admissionNumber, admissionNo: admissionNumber, schoolId,
      studentName: name, studentNameLower: name.toLowerCase(),
      class: cls, classId: cls, section, sectionId: section,
      branchId: "default-branch", academicYearId, status: "active",
      rollNo: Number(admissionNumber.replace(/\D/g, "") || 0),
      gender: "", fatherName: "", fatherPhone: phone, motherName: "", motherPhone: "",
      dateOfBirth: null, email: "", phone, address: village,
      photoURL: "", aadhaarNumber: "", documentURLs: [],
      previousSchool: null, siblingAdmissionNumbers: [], emergencyContact: null,
      transportRouteId: route, transportStopName: village, transportFee: 0,
      annualEnrollmentFee: 0, commitmentFee: 0, committedPayableFee: 0, originalFeeAmount: 0,
      totalConcessionAmount: 0, feeHeads: null,
      totalFeeAmount: 0, totalFeesDue: 0, totalFeesPaid: 0, feeStatus: "paid",
      attendancePercentage: 0, admissionStatus: "approved",
      searchKeywords: Array.from(new Set([admissionNumber.toLowerCase(), ...name.toLowerCase().split(/\s+/).filter(Boolean)])),
      feeLastUpdated: now, createdAt: now, updatedAt: now
    });
    batch.set(db.collection("studentFeeSummaries").doc(`${ref.id}_${academicYearId || "default"}`), {
      studentId: ref.id, schoolId, branchId: "default-branch", academicYearId,
      classId: cls, sectionId: section, studentName: name, admissionNumber, phone,
      className: cls, sectionName: section,
      totalFee: 0, totalPaid: 0, totalConcession: 0, committedPayableFee: 0,
      originalFeeAmount: 0, dueAmount: 0, updatedAt: now
    }, { merge: true });
    summary.created++;
    ops += 2;
    if (ops >= 400) await flush();
  }
  await flush();
  await counterRef.set({ nextAdmission: next, updatedAt: now }, { merge: true });
  return summary;
}
