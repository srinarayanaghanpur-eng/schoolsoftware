import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildQueuedPayload,
  capQueue,
  classifySubmitFailure,
  newUuid,
  OFFLINE_QUEUE_CAP,
  type QueuedAttempt
} from "./offlineQueue";

function attempt(id: string): QueuedAttempt {
  return {
    clientRequestId: id,
    action: "checkin",
    capturedAt: "2026-09-29T08:00:00.000Z",
    lat: 17.4,
    lng: 78.5,
    accuracy: 12,
    payload: { teacherId: "t1", eventType: "checkin" }
  };
}

describe("newUuid", () => {
  it("produces v4-shaped unique ids", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      const id = newUuid();
      assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      seen.add(id);
    }
    assert.equal(seen.size, 50);
  });
});

describe("capQueue", () => {
  it("keeps the newest 20, evicting oldest first", () => {
    const queue = Array.from({ length: 25 }, (_, i) => attempt(`id-${i}`));
    const capped = capQueue(queue);
    assert.equal(capped.length, OFFLINE_QUEUE_CAP);
    assert.equal(capped[0].clientRequestId, "id-5");
    assert.equal(capped[capped.length - 1].clientRequestId, "id-24");
  });

  it("leaves short queues untouched", () => {
    const queue = [attempt("a"), attempt("b")];
    assert.equal(capQueue(queue).length, 2);
    assert.equal(capQueue([]).length, 0);
  });
});

describe("classifySubmitFailure", () => {
  it("queues network failures and retryable statuses only", () => {
    assert.equal(classifySubmitFailure(undefined), "network");
    assert.equal(classifySubmitFailure(429), "retryable-status");
    assert.equal(classifySubmitFailure(500), "retryable-status");
    assert.equal(classifySubmitFailure(503), "retryable-status");
  });

  it("treats every 4xx as definitive", () => {
    for (const status of [400, 401, 403, 404, 422]) {
      assert.equal(classifySubmitFailure(status), "definitive", `status ${status}`);
    }
  });
});

describe("buildQueuedPayload", () => {
  it("merges identity keys without mutating the stored attempt", () => {
    const queued = attempt("uuid-1");
    const body = buildQueuedPayload(queued);
    assert.equal(body.clientRequestId, "uuid-1");
    assert.equal(body.capturedAt, "2026-09-29T08:00:00.000Z");
    assert.equal(body.teacherId, "t1");
    assert.ok(!("clientRequestId" in queued.payload));
  });
});
