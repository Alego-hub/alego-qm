import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

const core = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end("{}");
});
await new Promise<void>((resolveListen) => core.listen(0, "127.0.0.1", resolveListen));

process.env.CORE_API_URL = `http://127.0.0.1:${(core.address() as AddressInfo).port}`;
process.env.CORE_SIGNING_SECRET = "local-core-secret";
process.env.WEB_UI_COOKIE_AUTH = "1";
process.env.WEB_UI_PRINCIPALS = "alice";
process.env.ALLOW_UNSIGNED_TEST_IDENTITY = "0";

const { handler } = await import("../server/index.ts");
const surface = createServer((req, res) => void handler(req, res));
await new Promise<void>((resolveListen) => surface.listen(0, "127.0.0.1", resolveListen));
const base = `http://127.0.0.1:${(surface.address() as AddressInfo).port}`;

test.after(() => {
  surface.close();
  core.close();
});

test("a loopback Alego surface keeps local sign-in when core traffic is signed", async () => {
  const signin = await fetch(`${base}/signin`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user: "alice" }),
  });
  assert.equal(signin.status, 200);
  const cookie = (signin.headers.get("set-cookie") ?? "").split(";")[0];

  const me = await fetch(`${base}/me`, { headers: { cookie } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).mode, "dev");
});
