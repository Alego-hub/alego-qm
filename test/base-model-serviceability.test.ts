import "./support/auto-fake-sprites.ts";

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { createInsecureTestServer } from "../src/api/server.ts";
import { buildApp } from "../src/wiring.ts";
import { testConfig } from "./support/test-config.ts";

const ADMIN = { "content-type": "application/json", "x-admin-actor": "admin-alice@default-org" };

function start() {
  const built = buildApp(testConfig({ dataDir: mkdtempSync(join(tmpdir(), "base-model-svc-")) }));
  const server = createInsecureTestServer(built.app, {
    config: built.config,
    admin: built.admin,
    auditLog: built.auditLog,
    acl: built.acl,
    harnessId: "pi",
    providerKeys: { anthropic: true, openai: false, openrouter: false },
  });
  server.listen(0);
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;
  return { base, close: () => new Promise<void>((r) => server.close(() => r())) };
}

test("base-model set rejects a model whose provider key is absent (would fail provider-side)", async () => {
  const srv = start();
  try {
    const bad = await fetch(`${srv.base}/v1/admin/scopes/org:default-org/base-model`, {
      method: "PUT",
      headers: ADMIN,
      body: JSON.stringify({ modelId: "gpt-5.6-sol" }),
    });
    assert.equal(bad.status, 400);
    assert.match(((await bad.json()) as { message?: string }).message ?? "", /serviceable|provider key/i);

    const ok = await fetch(`${srv.base}/v1/admin/scopes/org:default-org/base-model`, {
      method: "PUT",
      headers: ADMIN,
      body: JSON.stringify({ modelId: "claude-opus-4-8" }),
    });
    assert.equal(ok.status, 200, "an Anthropic model stays selectable when the Anthropic key is present");
  } finally {
    await srv.close();
  }
});
