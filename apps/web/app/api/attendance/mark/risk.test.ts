import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACCURACY_REVIEW_THRESHOLD_METERS,
  shouldFlagAccuracy,
  shouldRejectMockLocation
} from "./risk";

describe("shouldRejectMockLocation", () => {
  it("rejects mock locations for non-admin teachers", () => {
    assert.equal(shouldRejectMockLocation(false, true), true);
  });

  it("allows admins to submit mock-location test records", () => {
    assert.equal(shouldRejectMockLocation(true, true), false);
  });

  it("does not reject real fixes or missing flags", () => {
    assert.equal(shouldRejectMockLocation(false, false), false);
    assert.equal(shouldRejectMockLocation(false, undefined), false);
  });
});

describe("shouldFlagAccuracy", () => {
  it("flags accuracy above the review threshold", () => {
    assert.equal(shouldFlagAccuracy(ACCURACY_REVIEW_THRESHOLD_METERS + 1), true);
    assert.equal(shouldFlagAccuracy(250), true);
  });

  it("does not flag accuracy at or below the threshold", () => {
    assert.equal(shouldFlagAccuracy(ACCURACY_REVIEW_THRESHOLD_METERS), false);
    assert.equal(shouldFlagAccuracy(12), false);
    assert.equal(shouldFlagAccuracy(undefined), false);
    assert.equal(shouldFlagAccuracy(Number.NaN), false);
  });
});
