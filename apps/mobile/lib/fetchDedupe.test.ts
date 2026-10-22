import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deduped, inflightCount } from "./fetchDedupe";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("deduped", () => {
  it("shares one promise between concurrent identical calls", async () => {
    let calls = 0;
    const gate = deferred<string>();
    const first = deduped("GET /x", () => {
      calls += 1;
      return gate.promise;
    });
    const second = deduped("GET /x", () => {
      calls += 1;
      return Promise.resolve("second");
    });
    assert.equal(calls, 1);
    assert.equal(inflightCount(), 1);
    gate.resolve("shared");
    assert.deepEqual(await Promise.all([first, second]), ["shared", "shared"]);
    assert.equal(inflightCount(), 0);
  });

  it("does not share across different keys", async () => {
    const a = deduped("GET /a", () => Promise.resolve(1));
    const b = deduped("GET /b", () => Promise.resolve(2));
    assert.deepEqual(await Promise.all([a, b]), [1, 2]);
  });

  it("releases the key on failure so later calls retry", async () => {
    const gate = deferred<string>();
    const failing = deduped("GET /y", () => gate.promise);
    const alsoWaiting = deduped("GET /y", () => Promise.resolve("unused"));
    gate.reject(new Error("offline"));
    await assert.rejects(() => failing);
    await assert.rejects(() => alsoWaiting);
    assert.equal(inflightCount(), 0);
    const retry = await deduped("GET /y", () => Promise.resolve("recovered"));
    assert.equal(retry, "recovered");
  });
});
