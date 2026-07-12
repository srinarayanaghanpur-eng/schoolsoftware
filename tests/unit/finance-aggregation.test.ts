/**
 * Unit tests for Finance Dashboard aggregation helpers.
 * Run with: npx tsx tests/unit/finance-aggregation.test.ts
 */
import assert from "node:assert/strict";

import {
  aggregateCollectionByMethod,
  aggregateDuesByClass,
  aggregateExpenseBreakdown,
  normalizeMethod,
  toNumberSafe,
  isCompletedStatus,
} from "../../apps/web/lib/financeAggregation";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}\n    ${(err as Error).message}`);
  }
}

const get = (rows: { method: string; amount: number }[], m: string) =>
  rows.find((r) => r.method === m)?.amount ?? 0;

console.log("Collection by Method");

test("visible example: Cash ₹52,800 + Online ₹13,000 + UPI ₹8,000 = ₹73,800", () => {
  const rows = aggregateCollectionByMethod([
    { id: "p1", data: { status: "completed", paymentMethod: "cash", amountPaid: 35000 } },
    { id: "p2", data: { status: "completed", paymentMethod: "Cash", amountPaid: "17,800" } },
    { id: "p3", data: { status: "Completed", method: "online", paidAmount: 13000 } },
    { id: "p4", data: { status: "paid", mode: "UPI", amount: "₹8,000" } },
  ]);
  assert.equal(get(rows, "Cash"), 52800);
  assert.equal(get(rows, "Online/Bank"), 13000);
  assert.equal(get(rows, "UPI"), 8000);
  assert.equal(rows.reduce((s, r) => s + r.amount, 0), 73800);
});

test("multiple installments for one student are all counted", () => {
  const rows = aggregateCollectionByMethod([
    { id: "a", data: { studentId: "s1", status: "completed", paymentMethod: "cash", amountPaid: 1000 } },
    { id: "b", data: { studentId: "s1", status: "completed", paymentMethod: "cash", amountPaid: 2000 } },
  ]);
  assert.equal(get(rows, "Cash"), 3000);
});

test("duplicate payment docs (same id) are counted once", () => {
  const doc = { id: "dup", data: { status: "completed", paymentMethod: "cash", amountPaid: 500 } };
  const rows = aggregateCollectionByMethod([doc, doc]);
  assert.equal(get(rows, "Cash"), 500);
});

test("method capitalization / aliases normalized", () => {
  assert.equal(normalizeMethod("CASH"), "Cash");
  assert.equal(normalizeMethod("GPay"), "UPI");
  assert.equal(normalizeMethod("PhonePe"), "UPI");
  assert.equal(normalizeMethod("NEFT"), "Online/Bank");
  assert.equal(normalizeMethod("Bank Transfer"), "Online/Bank");
  assert.equal(normalizeMethod("card"), "Card");
  assert.equal(normalizeMethod("CHEQUE"), "Cheque");
  assert.equal(normalizeMethod("crypto"), "Other");
});

test("cancelled/failed payments excluded", () => {
  const rows = aggregateCollectionByMethod([
    { id: "1", data: { status: "cancelled", paymentMethod: "cash", amountPaid: 9999 } },
    { id: "2", data: { status: "Failed", paymentMethod: "upi", amountPaid: 9999 } },
    { id: "3", data: { status: "completed", paymentMethod: "cash", amountPaid: 100 } },
  ]);
  assert.equal(rows.reduce((s, r) => s + r.amount, 0), 100);
});

test("string amounts parsed safely", () => {
  assert.equal(toNumberSafe("₹1,23,456"), 123456);
  assert.equal(toNumberSafe("abc"), 0);
  assert.equal(toNumberSafe(NaN), 0);
});

test("status normalization", () => {
  assert.ok(isCompletedStatus("Completed"));
  assert.ok(isCompletedStatus("paid"));
  assert.ok(!isCompletedStatus("pending"));
  assert.ok(!isCompletedStatus("CANCELLED"));
});

console.log("Dues by Class");

test("groups positive dues by class, excludes fully paid", () => {
  const rows = aggregateDuesByClass([
    { id: "s1_y1", data: { studentId: "s1", className: "Class 5", dueAmount: 4000 } },
    { id: "s2_y1", data: { studentId: "s2", className: "Class 5", dueAmount: 0 } }, // fully paid
    { id: "s3_y1", data: { studentId: "s3", className: "Class 6", dueAmount: 2500 } },
  ]);
  const c5 = rows.find((r) => r.className === "Class 5")!;
  assert.equal(c5.dueAmount, 4000);
  assert.equal(c5.dueCount, 1);
  assert.equal(c5.total, 2);
  assert.equal(rows.find((r) => r.className === "Class 6")!.dueAmount, 2500);
});

test("class with no dues is omitted entirely", () => {
  const rows = aggregateDuesByClass([
    { id: "a", data: { studentId: "a", className: "Class 1", dueAmount: 0 } },
  ]);
  assert.equal(rows.length, 0);
});

test("deleted/inactive records excluded", () => {
  const rows = aggregateDuesByClass([
    { id: "a", data: { studentId: "a", className: "C1", dueAmount: 100, deleted: true } },
    { id: "b", data: { studentId: "b", className: "C1", dueAmount: 100, active: false } },
  ]);
  assert.equal(rows.length, 0);
});

test("duplicate summaries per student counted once", () => {
  const rows = aggregateDuesByClass([
    { id: "s1_a", data: { studentId: "s1", className: "C1", dueAmount: 100 } },
    { id: "s1_b", data: { studentId: "s1", className: "C1", dueAmount: 100 } },
  ]);
  assert.equal(rows[0].dueAmount, 100);
});

test("classId mapped through classes collection; fallback fields work", () => {
  const map = new Map([["cls_10", "Class 10"]]);
  const rows = aggregateDuesByClass(
    [
      { id: "a", data: { studentId: "a", classId: "cls_10", dueAmount: 500 } },
      { id: "b", data: { studentId: "b", grade: "7", dueAmount: 300 } },
    ],
    map
  );
  assert.ok(rows.find((r) => r.className === "Class 10"));
  assert.ok(rows.find((r) => r.className === "7"));
});

test("due derived from fee − concession − paid when dueAmount missing", () => {
  const rows = aggregateDuesByClass([
    { id: "a", data: { studentId: "a", className: "C1", totalFee: 10000, totalConcession: 1000, totalPaid: 4000 } },
  ]);
  assert.equal(rows[0].dueAmount, 5000);
});

console.log("Expense Breakdown");

test("groups approved expenses by category, excludes rejected/pending", () => {
  const rows = aggregateExpenseBreakdown([
    { id: "1", data: { status: "approved", category: "stationery", amount: 1200 } },
    { id: "2", data: { status: "Approved", category: "stationery", amount: "800" } },
    { id: "3", data: { status: "rejected", category: "misc", amount: 5000 } },
    { id: "4", data: { status: "pending", category: "misc", amount: 5000 } },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].category, "stationery");
  assert.equal(rows[0].amount, 2000);
});

test("empty input → empty result (genuine 'No expense data')", () => {
  assert.equal(aggregateExpenseBreakdown([]).length, 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
