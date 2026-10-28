export type FeeStatus = "paid" | "partial" | "pending";

export type FeeState = {
  originalFee: number;
  payableFee: number;
  concession: number;
  paid: number;
  due: number;
  status: FeeStatus;
  hasOriginalFee: boolean;
  hasPayableFee: boolean;
  hasConcession: boolean;
};

type NumberField = {
  value: number;
  present: boolean;
};

export function toFeeAmount(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

function readNumber(...values: unknown[]): NumberField {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const amount = Number(value);
    if (Number.isFinite(amount)) {
      return { value: Math.max(0, amount), present: true };
    }
  }
  return { value: 0, present: false };
}

export function feeStatusFor(due: number, paid: number): FeeStatus {
  return due <= 0 ? "paid" : paid > 0 ? "partial" : "pending";
}

export function feeHeadsTotals(heads: unknown): {
  original: number;
  committed: number;
  count: number;
} | null {
  if (!Array.isArray(heads) || heads.length === 0) return null;

  let original = 0;
  let committed = 0;
  for (const raw of heads) {
    if (!raw || typeof raw !== "object") continue;
    const head = raw as Record<string, unknown>;
    const originalAmount = toFeeAmount(head.original ?? head.amount);
    const committedAmount = toFeeAmount(head.committed ?? head.amount ?? head.original);
    original += originalAmount;
    committed += committedAmount;
  }

  return { original, committed, count: heads.length };
}

export function resolveFeeState(record: Record<string, unknown>): FeeState {
  const original = readNumber(record.originalFeeAmount, record.annualEnrollmentFee);
  const total = readNumber(record.totalFeeAmount);
  const committed = readNumber(record.committedPayableFee, record.commitmentFee);
  const storedConcession = readNumber(record.totalConcessionAmount, record.concession);
  const paidField = readNumber(record.totalFeesPaid);
  const dueField = readNumber(record.totalFeesDue);

  let originalFee = original.value;
  let hasOriginalFee = original.present;
  if (!hasOriginalFee) {
    if (total.present && storedConcession.present) {
      originalFee = total.value + storedConcession.value;
      hasOriginalFee = true;
    } else if (committed.present) {
      originalFee = committed.value;
      hasOriginalFee = true;
    } else if (total.present) {
      originalFee = total.value;
      hasOriginalFee = true;
    } else if (dueField.present) {
      originalFee = paidField.value + dueField.value;
      hasOriginalFee = true;
    }
  }

  let payableFee = 0;
  let hasPayableFee = false;
  if (committed.present) {
    payableFee = committed.value;
    hasPayableFee = true;
    if (
      original.present &&
      storedConcession.present &&
      storedConcession.value > 0 &&
      committed.value === original.value
    ) {
      payableFee = Math.max(0, original.value - storedConcession.value);
    }
  } else if (original.present && storedConcession.present) {
    payableFee = Math.max(0, original.value - storedConcession.value);
    hasPayableFee = true;
  } else if (total.present) {
    payableFee = total.value;
    hasPayableFee = true;
  } else if (original.present) {
    payableFee = originalFee;
    hasPayableFee = true;
  } else if (dueField.present) {
    payableFee = paidField.value + dueField.value;
    hasPayableFee = true;
  }

  let concession = 0;
  let hasConcession = false;
  if (hasOriginalFee && hasPayableFee) {
    concession = Math.max(storedConcession.value, Math.max(0, originalFee - payableFee));
    hasConcession = storedConcession.present || concession > 0;
  } else if (storedConcession.present) {
    concession = storedConcession.value;
    hasConcession = true;
  }
  if (hasOriginalFee) concession = Math.min(concession, originalFee);

  const paid = paidField.value;
  const due = Math.max(0, payableFee - paid);

  return {
    originalFee,
    payableFee,
    concession,
    paid,
    due,
    status: feeStatusFor(due, paid),
    hasOriginalFee,
    hasPayableFee,
    hasConcession,
  };
}

export function buildFeeFields(input: {
  originalFee: unknown;
  payableFee: unknown;
  paid?: unknown;
}) {
  const original = toFeeAmount(input.originalFee);
  const payable =
    input.payableFee === null || input.payableFee === undefined || input.payableFee === ""
      ? original
      : toFeeAmount(input.payableFee);
  const paid = toFeeAmount(input.paid);
  const due = Math.max(0, payable - paid);
  const concession = Math.max(0, original - payable);

  return {
    originalFeeAmount: original,
    annualEnrollmentFee: original,
    committedPayableFee: payable,
    commitmentFee: payable,
    totalFeeAmount: payable,
    totalConcessionAmount: concession,
    totalFeesPaid: paid,
    totalFeesDue: due,
    feeStatus: feeStatusFor(due, paid),
  };
}

export function applyConcessionToState(state: FeeState, concessionAmount: unknown) {
  const original =
    state.originalFee > 0
      ? state.originalFee
      : state.payableFee + state.concession;
  const requested = toFeeAmount(concessionAmount);
  const concession = Math.min(original, state.concession + requested);
  const payableFee = Math.max(0, original - concession);
  const due = Math.max(0, payableFee - state.paid);

  return {
    originalFeeAmount: original,
    annualEnrollmentFee: original,
    committedPayableFee: payableFee,
    commitmentFee: payableFee,
    totalFeeAmount: payableFee,
    totalConcessionAmount: concession,
    totalFeesPaid: state.paid,
    totalFeesDue: due,
    feeStatus: feeStatusFor(due, state.paid),
  };
}
