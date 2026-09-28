import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  approvalRequestReviewSchema,
  expenseCreateSchema,
  parentCreateSchema,
  paymentConfirmSchema,
  paymentOrderSchema
} from "./schemas";

describe("paymentOrderSchema", () => {
  it("rejects zero and negative amounts", () => {
    assert.throws(() => paymentOrderSchema.parse({ studentId: "s1", amount: 0 }));
    assert.throws(() => paymentOrderSchema.parse({ studentId: "s1", amount: -5 }));
  });

  it("rejects a missing studentId", () => {
    assert.throws(() => paymentOrderSchema.parse({ amount: 100 }));
  });

  it("coerces string amounts and applies defaults", () => {
    const order = paymentOrderSchema.parse({ studentId: "s1", amount: "250" });
    assert.equal(order.amount, 250);
    assert.equal(order.paymentType, "tuition");
    assert.equal(order.note, "");
  });
});

describe("paymentConfirmSchema", () => {
  it("requires an orderId", () => {
    assert.throws(() => paymentConfirmSchema.parse({}));
  });

  it("applies method/transaction defaults", () => {
    const confirm = paymentConfirmSchema.parse({ orderId: "o1" });
    assert.equal(confirm.method, "online");
    assert.equal(confirm.transactionId, "");
  });
});

describe("approvalRequestReviewSchema", () => {
  it("accepts only decided statuses — pending can never be submitted", () => {
    approvalRequestReviewSchema.parse({ status: "approved" });
    approvalRequestReviewSchema.parse({ status: "rejected" });
    assert.throws(() => approvalRequestReviewSchema.parse({ status: "pending" }));
    assert.throws(() => approvalRequestReviewSchema.parse({ status: "cancelled" }));
  });
});

describe("parentCreateSchema", () => {
  const valid = {
    fullName: "Ramachandra Rao",
    phone: "9848012345",
    loginId: "PAR001",
    email: "",
    password: "Str0ngPass!",
    confirmPassword: "Str0ngPass!"
  };

  it("accepts a valid payload", () => {
    parentCreateSchema.parse(valid);
  });

  it("rejects mismatched passwords", () => {
    assert.throws(() => parentCreateSchema.parse({ ...valid, confirmPassword: "Different1!" }));
  });

  it("rejects passwords under 8 characters", () => {
    assert.throws(() => parentCreateSchema.parse({ ...valid, password: "Sh0rt", confirmPassword: "Sh0rt" }));
  });

  it("rejects short phone numbers and names", () => {
    assert.throws(() => parentCreateSchema.parse({ ...valid, phone: "12345" }));
    assert.throws(() => parentCreateSchema.parse({ ...valid, fullName: "R" }));
  });
});

describe("expenseCreateSchema", () => {
  it("rejects non-positive amounts", () => {
    assert.throws(() =>
      expenseCreateSchema.parse({ category: "Utilities", amount: -1, date: "2026-09-01", description: "Power" })
    );
    assert.throws(() =>
      expenseCreateSchema.parse({ category: "Utilities", amount: 0, date: "2026-09-01", description: "Power" })
    );
  });
});
