import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { asDateString, asText, displayLoginContact } from "./text";

describe("asText", () => {
  it("passes strings through and stringifies scalars", () => {
    assert.equal(asText("Aarav"), "Aarav");
    assert.equal(asText(2500), "2500");
    assert.equal(asText(false), "false");
  });

  it("falls back for objects, null and undefined", () => {
    assert.equal(asText({ _seconds: 1, _nanoseconds: 0 }), "");
    assert.equal(asText(null), "");
    assert.equal(asText(undefined), "");
    assert.equal(asText(null, "—"), "—");
  });
});

describe("displayLoginContact", () => {
  it("hides internal addresses and shows the login ID instead", () => {
    assert.equal(displayLoginContact({ email: "snhs@srinarayana.local", employeeId: "PAR001" }), "PAR001");
    assert.equal(displayLoginContact({ email: "Snhs@SriNarayana.Local", employeeId: "PAR001" }), "PAR001");
    assert.equal(displayLoginContact({ email: "parent@gmail.com", employeeId: "PAR001" }), "parent@gmail.com");
    assert.equal(displayLoginContact({ employeeId: "TCH002" }), "TCH002");
    assert.equal(displayLoginContact(null), "");
  });
});

describe("asDateString", () => {
  it("converts Timestamp-shaped objects to ISO dates", () => {
    assert.equal(asDateString({ _seconds: 1759104000, _nanoseconds: 0 }), "2025-09-29");
    assert.equal(asDateString("2026-09-29"), "2026-09-29");
  });

  it("falls back for anything else", () => {
    assert.equal(asDateString(null), "");
    assert.equal(asDateString(12345), "");
    assert.equal(asDateString({}), "");
  });
});
