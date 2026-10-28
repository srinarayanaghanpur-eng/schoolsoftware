/**
 * Assign class-based annual fees to every active student and refresh the
 * canonical studentFeeSummaries documents.
 *
 * Default is a dry run. Pass --apply to write.
 *
 * Run: npx tsx scripts/assign-class-fees.ts [--apply]
 */
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

loadEnvConfig(path.join(process.cwd(), "apps", "web"));

const APPLY = process.argv.includes("--apply");

const CLASS_BASE: Record<string, number> = {
  Nur: 15000,
  LKG: 16000,
  UKG: 17000,
  "1": 18000,
  "2": 19500,
  "3": 21000,
  "4": 22500,
  "5": 25000,
  "6": 27000,
  "7": 29000,
  "8": 31000,
  "9": 33000,
  "10": 35000
};

function classKey(value: unknown) {
  return String(value ?? "").trim();
}

function hash(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  }
  return h;
}

function feeTotalFor(id: string, className: string) {
  const base = CLASS_BASE[className];
  if (!base) return null;
  const variation = [-500, 0, 500][hash(id) % 3];
  return Math.min(35000, Math.max(15000, base + variation));
}

function splitTotal(total: number) {
  const books = Math.round((total * 0.4) / 500) * 500;
  const tuition = total - books;
  return { tuition, books };
}

function parseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "";
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is missing");
  return JSON.parse(raw.replace(/^'|'$/g, ""));
}

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: cert(parseServiceAccount()) });
  }
  const db = getFirestore();

  console.log(APPLY ? "MODE: APPLY" : "MODE: DRY RUN (pass --apply to write)");

  const [studentSnap, summarySnap] = await Promise.all([
    db.collection("students").get(),
    db.collection("studentFeeSummaries").get()
  ]);
  const summaries = new Map(summarySnap.docs.map((doc) => [doc.id, doc.data()]));

  const active = studentSnap.docs.filter((doc) => doc.data().status === "active");
  console.log(`Students: ${studentSnap.size} total, ${active.length} active`);

  const byClass = new Map<string, { count: number; min: number; max: number; total: number }>();
  const skipped: string[] = [];
  const samples: Array<Record<string, unknown>> = [];
  let batch = db.batch();
  let ops = 0;

  for (const doc of active) {
    const data = doc.data();
    const className = classKey(data.class ?? data.classId);
    const total = feeTotalFor(doc.id, className);
    if (total === null) {
      skipped.push(`${doc.id} (${data.admissionNumber ?? "no admission"}) class=${className || "none"}`);
      continue;
    }

    const { tuition, books } = splitTotal(total);
    const yearId = String(data.academicYearId ?? "");
    const summary = summaries.get(`${doc.id}_${yearId}`) ?? {};
    const paid = Math.max(
      Number(data.totalFeesPaid ?? 0),
      Number(summary.totalPaid ?? 0)
    );
    const due = Math.max(0, total - paid);
    const feeStatus = due <= 0 ? "paid" : paid > 0 ? "partial" : "pending";
    const now = new Date();

    const feeHeads = [
      { name: "Tuition Fee", original: tuition, committed: tuition },
      { name: "Books", original: books, committed: books }
    ];

    const row = byClass.get(className) ?? { count: 0, min: total, max: total, total: 0 };
    row.count += 1;
    row.min = Math.min(row.min, total);
    row.max = Math.max(row.max, total);
    row.total += total;
    byClass.set(className, row);

    if (samples.length < 8) {
      samples.push({
        admission: data.admissionNumber,
        class: className,
        total,
        tuition,
        books,
        paid,
        due,
        feeStatus
      });
    }

    if (APPLY) {
      batch.update(doc.ref, {
        annualEnrollmentFee: total,
        originalFeeAmount: total,
        commitmentFee: total,
        committedPayableFee: total,
        totalFeeAmount: total,
        totalConcessionAmount: 0,
        totalFeesPaid: paid,
        totalFeesDue: due,
        feeStatus,
        feeHeads,
        feeLastUpdated: now,
        updatedAt: now
      });
      ops += 1;

      batch.set(
        db.collection("studentFeeSummaries").doc(`${doc.id}_${yearId}`),
        {
          studentId: doc.id,
          studentName: data.studentName ?? summary.studentName ?? "",
          admissionNumber: data.admissionNumber ?? summary.admissionNumber ?? "",
          phone: data.phone ?? data.fatherPhone ?? summary.phone ?? "",
          schoolId: data.schoolId ?? summary.schoolId ?? "default-school",
          branchId: data.branchId ?? summary.branchId ?? "default-branch",
          academicYearId: yearId,
          classId: data.classId ?? className,
          className,
          sectionId: data.section ?? summary.sectionId ?? "",
          sectionName: data.section ?? summary.sectionName ?? "",
          originalFeeAmount: total,
          committedPayableFee: total,
          totalFee: total,
          totalConcession: 0,
          totalPaid: paid,
          dueAmount: due,
          updatedAt: now
        },
        { merge: true }
      );
      ops += 1;

      if (ops >= 400) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
        console.log(`Committed ${active.indexOf(doc) + 1}/${active.length}...`);
      }
    }
  }

  if (APPLY && ops > 0) await batch.commit();

  const yearIds = [...new Set(active.map((doc) => String(doc.data().academicYearId ?? "")).filter(Boolean))];
  const structureSnap = await db.collection("fee_structures").get();
  const existingStructures = new Map(
    structureSnap.docs.map((doc) => [`${String(doc.data().academicYearId ?? "")}::${classKey(doc.data().className)}`, doc.ref])
  );
  let structureWrites = 0;

  for (const yearId of yearIds) {
    const schoolId =
      active.find((doc) => String(doc.data().academicYearId ?? "") === yearId)?.data().schoolId ??
      "default-school";
    for (const [className, base] of Object.entries(CLASS_BASE)) {
      const { tuition, books } = splitTotal(base);
      const key = `${yearId}::${className}`;
      const ref = existingStructures.get(key) ?? db.collection("fee_structures").doc(`${yearId}_${className}`);
      structureWrites += 1;
      if (!APPLY) continue;
      const now = new Date();
      const payload: Record<string, unknown> = {
        academicYearId: yearId,
        className,
        heads: [
          { name: "Tuition Fee", amount: tuition },
          { name: "Books", amount: books }
        ],
        total: base,
        schoolId,
        updatedAt: now
      };
      if (!existingStructures.has(key)) payload.createdAt = now;
      await ref.set(payload, { merge: true });
    }
  }

  console.log("\nClass totals:");
  for (const [className, row] of [...byClass.entries()].sort((a, b) => {
    const order = Object.keys(CLASS_BASE);
    return order.indexOf(a[0]) - order.indexOf(b[0]);
  })) {
    console.log(
      `${className.padEnd(4)} students=${String(row.count).padStart(3)} ` +
        `range=${row.min}-${row.max} total=${row.total}`
    );
  }

  console.log(
    `\nFee structures: ${structureWrites} ${APPLY ? "written across" : "would be written across"} ${yearIds.length} year(s)`
  );

  console.log("\nSamples:");
  console.table(samples);

  if (skipped.length) {
    console.log(`\nSkipped ${skipped.length}:`);
    for (const item of skipped) console.log(`- ${item}`);
  }

  if (APPLY) {
    await db.collection("sync").doc("dashboard_summary").set(
      {
        dirtyAt: FieldValue.serverTimestamp(),
        lastDirtyContext: "scripts:assign-class-fees"
      },
      { merge: true }
    );
    console.log("\nApplied student fees, summaries, and marked dashboard dirty.");
  } else {
    console.log("\nDry run complete. No writes performed.");
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
