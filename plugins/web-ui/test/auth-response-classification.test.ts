import { test } from "node:test";
import assert from "node:assert/strict";
import { api, ApiError, setSigninRequiredHandler, type SigninRequired } from "../src/core-bridge.ts";

const realFetch = globalThis.fetch;

function unauthorized(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

test("only the web authentication boundary can replace the app with the sign-in gate", async () => {
  const seen: SigninRequired[] = [];
  setSigninRequiredHandler((detail) => seen.push(detail));
  try {
    for (const body of [
      { error: "provider_unauthorized", message: "model provider rejected its key" },
      { error: "sign in" },
      { error: "sign in", mode: "provider", reason: "unauthenticated" },
      { error: "sign in", mode: "dev", reason: "upstream_unauthorized" },
    ]) {
      globalThis.fetch = (() => Promise.resolve(unauthorized(body))) as typeof fetch;
      await assert.rejects(api("/api/turn"), (error: unknown) => error instanceof ApiError && error.status === 401);
    }
    assert.deepEqual(seen, []);

    globalThis.fetch = (() =>
      Promise.resolve(unauthorized({ error: "sign in", mode: "dev", reason: "unauthenticated" }))) as typeof fetch;
    await assert.rejects(api("/api/turn"), (error: unknown) => error instanceof ApiError && error.status === 401);
    assert.deepEqual(seen, [{ error: "sign in", mode: "dev", reason: "unauthenticated" }]);
  } finally {
    globalThis.fetch = realFetch;
    setSigninRequiredHandler(() => undefined);
  }
});
