import test from "node:test";
import assert from "node:assert/strict";
import { startQm } from "../src/runtime.ts";
import { testConfig } from "./support/test-config.ts";

test("the shared QM lifecycle listens, serves health, and stops idempotently", async () => {
  const runtime = await startQm(testConfig({ allowUnauthenticatedCore: true, backgroundWorkEnabled: false }), {
    env: {},
    host: "127.0.0.1",
  });
  const response = await fetch(`http://127.0.0.1:${runtime.address.port}/healthz`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  await runtime.stop();
  await runtime.stop();
});
