import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";

let received: { method: string; url: string; signature: string; body: string } | undefined;

const core = createServer((req: IncomingMessage, res) => {
  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", () => {
    received = {
      method: req.method ?? "",
      url: req.url ?? "",
      signature: String(req.headers["x-signature"] ?? ""),
      body: Buffer.concat(chunks).toString(),
    };
    if (req.url?.startsWith("/v1/connectors/oauth/github/callback")) {
      res.writeHead(302, { location: "/keychain?connector=github&status=connected" });
      res.end();
      return;
    }
    res.writeHead(201, { "content-type": "application/json", "x-core-response": "yes" });
    res.end(JSON.stringify({ proxied: true }));
  });
});
await new Promise<void>((resolveListen) => core.listen(0, "127.0.0.1", resolveListen));

process.env.CORE_API_URL = `http://127.0.0.1:${(core.address() as AddressInfo).port}`;
delete process.env.CORE_SIGNING_SECRET;
delete process.env.PORTAL_IDENTITY_SECRET;

const { handler } = await import("../server/index.ts");
const surface = createServer((req, res) => void handler(req, res));
await new Promise<void>((resolveListen) => surface.listen(0, "127.0.0.1", resolveListen));
const base = `http://127.0.0.1:${(surface.address() as AddressInfo).port}`;

test.after(() => {
  surface.close();
  core.close();
});

test("the web listener preserves direct core API access under /v1", async () => {
  const response = await fetch(`${base}/v1/example?value=1`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-signature": "signed-request" },
    body: JSON.stringify({ hello: "world" }),
  });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("x-core-response"), "yes");
  assert.deepEqual(await response.json(), { proxied: true });
  assert.deepEqual(received, {
    method: "POST",
    url: "/v1/example?value=1",
    signature: "signed-request",
    body: JSON.stringify({ hello: "world" }),
  });
});

test("a successful OAuth callback preserves core's return redirect", async () => {
  const response = await fetch(`${base}/v1/connectors/oauth/github/callback?code=ready`, {
    redirect: "manual",
  });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/keychain?connector=github&status=connected");
  assert.equal(received?.url, "/v1/connectors/oauth/github/callback?code=ready");
});
