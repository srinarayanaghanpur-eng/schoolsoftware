import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { removeUndefinedFields } from "./firestoreSanitize";

describe("removeUndefinedFields", () => {
  it("drops top-level undefined values but keeps falsy ones", () => {
    const input = { a: undefined, b: null, c: 0, d: false, e: "" };
    assert.deepEqual(removeUndefinedFields(input), { b: null, c: 0, d: false, e: "" });
  });

  it("recursively cleans nested objects", () => {
    const input = {
      keep: "yes",
      drop: undefined,
      nested: { keep: 1, drop: undefined, deeper: { drop: undefined, keep: 2 } }
    };
    assert.deepEqual(removeUndefinedFields(input), {
      keep: "yes",
      nested: { keep: 1, deeper: { keep: 2 } }
    });
  });

  it("cleans objects inside arrays while preserving element order", () => {
    const input = [{ a: 1, drop: undefined }, undefined, { b: 2 }];
    const result = removeUndefinedFields(input);
    assert.deepEqual(result, [{ a: 1 }, undefined, { b: 2 }]);
  });

  it("returns primitives unchanged", () => {
    assert.equal(removeUndefinedFields(42), 42);
    assert.equal(removeUndefinedFields("x"), "x");
    assert.equal(removeUndefinedFields(null), null);
  });
});
