import assert from "node:assert/strict";
import test from "node:test";
import {
  applyConcessionToState,
  buildFeeFields,
  feeHeadsTotals,
  resolveFeeState,
} from "./feeModel";

test("no concession: due is payable minus paid", () => {
  const state = resolveFeeState({
    annualEnrollmentFee: 10000,
    committedPayableFee: 10000,
    totalFeeAmount: 10000,
    totalConcessionAmount: 0,
    totalFeesPaid: 4000,
  });

  assert.equal(state.payableFee, 10000);
  assert.equal(state.concession, 0);
  assert.equal(state.due, 6000);
  assert.equal(state.status, "partial");
});

test("approved concession is applied exactly once", () => {
  const state = resolveFeeState({
    annualEnrollmentFee: 10000,
    committedPayableFee: 7000,
    totalFeeAmount: 7000,
    totalConcessionAmount: 3000,
    totalFeesPaid: 2000,
  });

  assert.equal(state.payableFee, 7000);
  assert.equal(state.concession, 3000);
  assert.equal(state.due, 5000);
});

test("legacy annual fee without a payable is not a full concession", () => {
  const state = resolveFeeState({
    annualEnrollmentFee: 10000,
  });

  assert.equal(state.payableFee, 10000);
  assert.equal(state.concession, 0);
  assert.equal(state.due, 10000);
});

test("legacy total fee plus concession resolves the payable", () => {
  const state = resolveFeeState({
    annualEnrollmentFee: 10000,
    totalFeeAmount: 10000,
    totalConcessionAmount: 3000,
    totalFeesPaid: 2000,
  });

  assert.equal(state.payableFee, 7000);
  assert.equal(state.concession, 3000);
  assert.equal(state.due, 5000);
});

test("legacy concession that was not reflected in committed payable is repaired", () => {
  const state = resolveFeeState({
    annualEnrollmentFee: 10000,
    committedPayableFee: 10000,
    totalFeeAmount: 10000,
    totalConcessionAmount: 3000,
  });

  assert.equal(state.payableFee, 7000);
  assert.equal(state.concession, 3000);
  assert.equal(state.due, 7000);
});

test("full concession has zero due", () => {
  const state = resolveFeeState({
    annualEnrollmentFee: 10000,
    committedPayableFee: 0,
    totalConcessionAmount: 10000,
  });

  assert.equal(state.payableFee, 0);
  assert.equal(state.concession, 10000);
  assert.equal(state.due, 0);
  assert.equal(state.status, "paid");
});

test("overpayment never produces a negative due", () => {
  const state = resolveFeeState({
    annualEnrollmentFee: 10000,
    committedPayableFee: 7000,
    totalFeesPaid: 9000,
  });

  assert.equal(state.due, 0);
  assert.equal(state.status, "paid");
});

test("fee head totals use original and committed values", () => {
  const totals = feeHeadsTotals([
    { original: 10000, committed: 7000 },
    { name: "Transport Fee", amount: 500 },
  ]);

  assert.deepEqual(totals, { original: 10500, committed: 7500, count: 2 });
});

test("buildFeeFields keeps the invariant", () => {
  const fields = buildFeeFields({
    originalFee: 10000,
    payableFee: 0,
    paid: 0,
  });

  assert.equal(fields.totalFeeAmount, 0);
  assert.equal(fields.totalConcessionAmount, 10000);
  assert.equal(fields.totalFeesDue, 0);
  assert.equal(fields.feeStatus, "paid");
});

test("applyConcessionToState adds to the existing concession", () => {
  const state = resolveFeeState({
    annualEnrollmentFee: 10000,
    committedPayableFee: 8000,
    totalConcessionAmount: 2000,
    totalFeesPaid: 1000,
  });
  const fields = applyConcessionToState(state, 3000);

  assert.equal(fields.totalConcessionAmount, 5000);
  assert.equal(fields.totalFeeAmount, 5000);
  assert.equal(fields.totalFeesDue, 4000);
  assert.equal(fields.feeStatus, "partial");
});
