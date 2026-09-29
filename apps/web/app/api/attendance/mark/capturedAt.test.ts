import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CAPTURED_AT_FUTURE_TOLERANCE_MS,
  CAPTURED_AT_MAX_AGE_MS,
  validateCapturedAt
} from "./capturedAt";

const NOW = Date.parse("2026-09-29T08:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();

describe("validateCapturedAt", () => {
  it("accepts missing captures (live path)", () => {
    assert.deepEqual(validateCapturedAt(undefined, NOW), { ok: true });
  });

  it("rejects unparseable timestamps", () => {
    const result = validateCapturedAt("not-a-date", NOW);
    assert.equal(result.ok, false);
  });

  it("accepts captures up to exactly 2 minutes in the future", () => {
    assert.deepEqual(validateCapturedAt(iso(NOW + CAPTURED_AT_FUTURE_TOLERANCE_MS), NOW), { ok: true });
    assert.deepEqual(validateCapturedAt(iso(NOW), NOW), { ok: true });
  });

  it("rejects captures 1ms past the future tolerance", () => {
    const result = validateCapturedAt(iso(NOW + CAPTURED_AT_FUTURE_TOLERANCE_MS + 1), NOW);
    assert.equal(result.ok, false);
    assert.match(
      (result as { error: string }).error,
      /future/
    );
  });

  it("accepts captures up to exactly 120 minutes old", () => {
    assert.deepEqual(validateCapturedAt(iso(NOW - CAPTURED_AT_MAX_AGE_MS), NOW), { ok: true });
    assert.deepEqual(validateCapturedAt(iso(NOW - 60 * 60 * 1000), NOW), { ok: true });
  });

  it("rejects captures 1ms past the age limit", () => {
    const result = validateCapturedAt(iso(NOW - CAPTURED_AT_MAX_AGE_MS - 1), NOW);
    assert.equal(result.ok, false);
    assert.match(
      (result as { error: string }).error,
      /2 hours/
    );
  });
});
