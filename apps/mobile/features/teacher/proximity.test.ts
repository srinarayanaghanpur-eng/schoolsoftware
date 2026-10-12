import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { proximityState } from "./proximity";

describe("proximityState", () => {
  it("reports weak when accuracy is 51 m even at a good distance", () => {
    assert.deepEqual(proximityState(10, 51), {
      kind: "weak",
      text: "Weak GPS signal. Move to an open area and tap Refresh location."
    });
  });

  it("reports ok at exactly the 150 m limit", () => {
    assert.deepEqual(proximityState(150, 10), {
      kind: "ok",
      text: "You\u2019re at campus"
    });
  });

  it("reports near just outside the limit", () => {
    const state = proximityState(151, 10);
    assert.equal(state.kind, "near");
  });

  it("reports far beyond 1000 m", () => {
    assert.deepEqual(proximityState(1001, 10), {
      kind: "far",
      text: "You\u2019re outside campus. Go to the school to check in."
    });
  });

  it("rounds near distances to the nearest 50 m", () => {
    assert.equal(proximityState(180, 10).text, "You\u2019re about 200 m from campus");
    assert.equal(proximityState(210, 10).text, "You\u2019re about 200 m from campus");
    assert.equal(proximityState(173, 10).text, "You\u2019re about 150 m from campus");
  });

  it("lets weak accuracy override a good distance", () => {
    assert.equal(proximityState(0, 6559).kind, "weak");
    assert.equal(proximityState(5, 51).kind, "weak");
  });
});
