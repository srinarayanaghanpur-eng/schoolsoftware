import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  chunkTokens,
  findDeadTokens,
  isValidExpoPushToken,
  pushRegisterSchema,
  sendPushToUsers,
  sha256Hex,
  type PushMessage
} from "./sendPush";

const GOOD_TOKEN = "ExponentPushToken[abcDEF123_-]";
const OTHER_TOKEN = "ExponentPushToken[xyz789]";
const MESSAGE: PushMessage = { title: "Absent today", body: "Aarav was marked absent on 2026-09-29." };

function okTicket(id: string) {
  return { status: "ok" as const, id };
}

describe("isValidExpoPushToken", () => {
  it("accepts well-formed Expo push tokens", () => {
    assert.equal(isValidExpoPushToken(GOOD_TOKEN), true);
    assert.equal(isValidExpoPushToken(OTHER_TOKEN), true);
  });

  it("rejects malformed tokens and non-strings", () => {
    assert.equal(isValidExpoPushToken(""), false);
    assert.equal(isValidExpoPushToken("ExponentPushToken[]"), false);
    assert.equal(isValidExpoPushToken("ExponentPushToken[has space]"), false);
    assert.equal(isValidExpoPushToken("FCM:abc123"), false);
    assert.equal(isValidExpoPushToken("ExponentPushToken[abc"), false);
    assert.equal(isValidExpoPushToken(null), false);
    assert.equal(isValidExpoPushToken(undefined), false);
    assert.equal(isValidExpoPushToken(123), false);
  });
});

describe("pushRegisterSchema", () => {
  it("accepts a token with optional platform", () => {
    const parsed = pushRegisterSchema.parse({ token: GOOD_TOKEN, platform: "android" });
    assert.equal(parsed.token, GOOD_TOKEN);
    assert.equal(parsed.platform, "android");
  });

  it("rejects bad tokens and platforms", () => {
    assert.throws(() => pushRegisterSchema.parse({ token: "nope" }));
    assert.throws(() => pushRegisterSchema.parse({ token: GOOD_TOKEN, platform: "web" }));
    assert.throws(() => pushRegisterSchema.parse({}));
  });
});

describe("sha256Hex", () => {
  it("is deterministic and 64 hex chars", () => {
    const first = sha256Hex(GOOD_TOKEN);
    assert.equal(first, sha256Hex(GOOD_TOKEN));
    assert.match(first, /^[0-9a-f]{64}$/);
    assert.notEqual(first, sha256Hex(OTHER_TOKEN));
  });
});

describe("chunkTokens", () => {
  it("splits 250 tokens into 100/100/50", () => {
    const tokens = Array.from({ length: 250 }, (_, i) => `t${i}`);
    const chunks = chunkTokens(tokens);
    assert.deepEqual(chunks.map((c) => c.length), [100, 100, 50]);
    assert.deepEqual(chunks.flat(), tokens);
  });

  it("handles empty input and custom sizes", () => {
    assert.deepEqual(chunkTokens([]), []);
    assert.deepEqual(chunkTokens(["a", "b", "c"], 2), [["a", "b"], ["c"]]);
  });
});

describe("findDeadTokens", () => {
  it("flags ticket-level DeviceNotRegistered", () => {
    const dead = findDeadTokens(
      [{ token: GOOD_TOKEN, ticket: { status: "error", message: "x", details: { error: "DeviceNotRegistered" } } }],
      {}
    );
    assert.deepEqual(dead, [GOOD_TOKEN]);
  });

  it("flags receipt-level DeviceNotRegistered for ok tickets", () => {
    const dead = findDeadTokens(
      [{ token: GOOD_TOKEN, ticket: okTicket("ticket-1") }],
      { "ticket-1": { status: "error", details: { error: "DeviceNotRegistered" } } }
    );
    assert.deepEqual(dead, [GOOD_TOKEN]);
  });

  it("ignores other errors and dedupes", () => {
    const dead = findDeadTokens(
      [
        { token: GOOD_TOKEN, ticket: { status: "error", message: "bad", details: { error: "MessageTooBig" } } },
        { token: OTHER_TOKEN, ticket: okTicket("t1") },
        { token: OTHER_TOKEN, ticket: { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } } }
      ],
      { t1: { status: "ok" } }
    );
    assert.deepEqual(dead, [OTHER_TOKEN]);
  });
});

describe("sendPushToUsers", () => {
  it("returns zeros without calling fetch when there are no uids", async () => {
    let calls = 0;
    const result = await sendPushToUsers([], MESSAGE, {
      fetchFn: (async () => {
        calls += 1;
        throw new Error("must not be called");
      }) as typeof fetch
    });
    assert.deepEqual(result, { sent: 0, failed: 0, removed: 0 });
    assert.equal(calls, 0);
  });

  it("counts sent tickets and never touches dead-token cleanup on success", async () => {
    const seen: string[] = [];
    const fetchFn = (async (url: unknown) => {
      seen.push(String(url));
      if (String(url).includes("push/send")) {
        return {
          text: async () =>
            JSON.stringify({ data: [okTicket("t1"), okTicket("t2")] })
        };
      }
      return { text: async () => JSON.stringify({ data: { t1: { status: "ok" }, t2: { status: "ok" } } }) };
    }) as unknown as typeof fetch;

    let removed: string[] = [];
    let touched: string[] = [];
    const result = await sendPushToUsers(["uid-1"], MESSAGE, {
      fetchFn,
      resolveTokens: async () => [GOOD_TOKEN, OTHER_TOKEN],
      removeTokens: async (tokens) => {
        removed = tokens;
      },
      touchTokens: async (tokens) => {
        touched = tokens;
      }
    });
    assert.deepEqual(result, { sent: 2, failed: 0, removed: 0 });
    assert.deepEqual(removed, []);
    assert.deepEqual([...touched].sort(), [GOOD_TOKEN, OTHER_TOKEN].sort());
    assert.equal(seen.length, 2);
  });

  it("removes tokens reported DeviceNotRegistered by receipts", async () => {
    const fetchFn = (async (url: unknown) => {
      if (String(url).includes("push/send")) {
        return { text: async () => JSON.stringify({ data: [okTicket("t1")] }) };
      }
      return {
        text: async () =>
          JSON.stringify({ data: { t1: { status: "error", details: { error: "DeviceNotRegistered" } } } })
      };
    }) as unknown as typeof fetch;

    let removed: string[] = [];
    const result = await sendPushToUsers(["uid-1"], MESSAGE, {
      fetchFn,
      resolveTokens: async () => [GOOD_TOKEN],
      removeTokens: async (tokens) => {
        removed = tokens;
      },
      touchTokens: async () => undefined
    });
    assert.deepEqual(result, { sent: 1, failed: 0, removed: 1 });
    assert.deepEqual(removed, [GOOD_TOKEN]);
  });

  it("never throws when fetch fails", async () => {
    const fetchFn = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const result = await sendPushToUsers(["uid-1"], MESSAGE, {
      fetchFn,
      resolveTokens: async () => [GOOD_TOKEN],
      removeTokens: async () => undefined,
      touchTokens: async () => undefined
    });
    assert.deepEqual(result, { sent: 0, failed: 0, removed: 0 });
  });

  it("honors the time budget on a hanging fetch", async () => {
    const fetchFn = (() => new Promise(() => undefined)) as unknown as typeof fetch;
    const started = Date.now();
    const result = await sendPushToUsers(["uid-1"], MESSAGE, {
      fetchFn,
      resolveTokens: async () => [GOOD_TOKEN],
      removeTokens: async () => undefined,
      touchTokens: async () => undefined,
      timeBudgetMs: 50
    });
    assert.deepEqual(result, { sent: 0, failed: 0, removed: 0 });
    assert.ok(Date.now() - started < 5000, "budget must resolve promptly");
  });
});
