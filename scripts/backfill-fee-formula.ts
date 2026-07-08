/**
 * Backfill script: Recalculate student fee records where totalFeeAmount was
 * wrongly saved as original + committed instead of committed only.
 *
 * Run: npx tsx scripts/backfill-fee-formula.ts
 *
 * Safe to run multiple times (idempotent).
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const SERVICE_ACCOUNT_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || "./service-account.json";

async function main() {
  const app = initializeApp({ credential: cert(SERVICE_ACCOUNT_PATH) });
  const db = getFirestore(app);

  console.log("Fetching all students...");
  const snapshot = await db.collection("students").get();
  console.log(`Found ${snapshot.docs.length} students`);

  let fixed = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();
      const originalFee = Number(data.annualEnrollmentFee || data.originalFeeAmount || 0);
      const committedPayable = Number(data.commitmentFee || data.committedPayableFee || data.totalFeeAmount || 0);
      const totalFeeAmount = Number(data.totalFeeAmount || 0);
      const paid = Number(data.totalFeesPaid || 0);

      // Detect wrong formula: totalFeeAmount ≈ originalFee + committedPayable
      const wrongSum = originalFee + committedPayable;
      const isWrong = totalFeeAmount > 0 && Math.abs(totalFeeAmount - wrongSum) < 1 && originalFee > 0 && committedPayable > 0 && originalFee !== committedPayable;

      if (isWrong) {
        const concession = Math.max(0, originalFee - committedPayable);
        const correctTotal = committedPayable;
        const due = Math.max(0, correctTotal - paid);
        const status = due <= 0 ? "paid" : paid > 0 ? "partial" : "pending";

        await db.collection("students").doc(doc.id).update({
          totalFeeAmount: correctTotal,
          totalFeesDue: due,
          totalConcessionAmount: concession,
          originalFeeAmount: originalFee,
          committedPayableFee: committedPayable,
          feeStatus: status,
          feeLastUpdated: new Date()
        });

        console.log(`FIXED ${data.admissionNumber || doc.id}: totalFeeAmount ${totalFeeAmount}→${correctTotal}, concession=${concession}, due=${due}`);
        fixed++;
      } else {
        // Ensure fields exist even if formula was already correct
        const needsOriginal = data.originalFeeAmount === undefined && originalFee > 0;
        const needsCommitted = data.committedPayableFee === undefined && committedPayable > 0;
        const needsConcession = data.totalConcessionAmount === undefined;
        const updates: Record<string, unknown> = {};

        if (needsOriginal) updates.originalFeeAmount = originalFee;
        if (needsCommitted) updates.committedPayableFee = committedPayable;
        if (needsConcession) updates.totalConcessionAmount = Math.max(0, originalFee - committedPayable);

        if (Object.keys(updates).length > 0) {
          await db.collection("students").doc(doc.id).update(updates);
          console.log(`BACKFILLED ${data.admissionNumber || doc.id}: added missing fields`);
        }
        skipped++;
      }
    } catch (err) {
      console.error(`ERROR processing ${doc.id}:`, err);
      errors++;
    }
  }

  console.log(`\nDone. Fixed: ${fixed}, Skipped: ${skipped}, Errors: ${errors}`);
  process.exit(0);
}

main();
