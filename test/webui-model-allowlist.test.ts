import "./support/auto-fake-sprites.ts";

import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createInsecureTestServer } from "../src/api/server.ts";
import { createMockHarness } from "../src/harness/mock-harness.ts";
import { buildApp } from "../src/wiring.ts";
import { testConfig } from "./support/test-config.ts";

const ADMIN = { "content-type": "application/json", "x-admin-actor": "admin-alice@default-org" };

test("the org allowed-models list restricts the runtime-config picker and clearing restores the catalog", async () => {
  const modelCredentialFetch: typeof fetch = async () =>
    Response.json({
      data: [
        { id: "anthropic/claude-sonnet-4.5", name: "Anthropic: Claude Sonnet 4.5", supported_parameters: ["tools"] },
        { id: "deepseek/deepseek-chat-v3.1", name: "DeepSeek: DeepSeek V3.1", supported_parameters: ["tools"] },
      ],
    });
  const built = buildApp(
    testConfig({
      dataDir: mkdtempSync(join(tmpdir(), "webui-model-allowlist-")),
      openrouterApiKey: "deployment-openrouter-key",
    }),
    { modelCredentialFetch },
  );
  const server = createInsecureTestServer(built.app, {
    config: built.config,
    modelCredentials: built.modelCredentials,
    modelCredentialFetch,
    harnessId: "pi",
    providerKeys: { anthropic: false, openai: false, openrouter: true },
    admin: built.admin,
    auditLog: built.auditLog,
  });
  server.listen(0);
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;
  const runtimeModels = async (): Promise<string[]> => {
    const response = await fetch(`${base}/v1/runtime-config?principalId=alice&scopeId=personal%3Aalice`);
    assert.equal(response.status, 200);
    return ((await response.json()) as { modelsByHarness: Record<string, string[]> }).modelsByHarness.pi!;
  };
  try {
    const unrestricted = await runtimeModels();
    assert.ok(unrestricted.includes("anthropic/claude-sonnet-4.5"));
    assert.ok(unrestricted.includes("deepseek/deepseek-chat-v3.1"));

    const saved = await fetch(`${base}/v1/admin/scopes/org%3Adefault-org/webui-models`, {
      method: "PUT",
      headers: ADMIN,
      body: JSON.stringify({ ids: ["deepseek/deepseek-chat-v3.1", "openrouter/auto"] }),
    });
    assert.equal(saved.status, 200);

    assert.deepEqual(await runtimeModels(), ["deepseek/deepseek-chat-v3.1", "openrouter/auto"]);

    const cleared = await fetch(`${base}/v1/admin/scopes/org%3Adefault-org/webui-models`, {
      method: "PUT",
      headers: ADMIN,
      body: JSON.stringify({ ids: [] }),
    });
    assert.equal(cleared.status, 200);
    const restored = await runtimeModels();
    assert.ok(restored.includes("anthropic/claude-sonnet-4.5"));
    assert.ok(restored.includes("deepseek/deepseek-chat-v3.1"));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("a harness-owned model list is the complete runtime-config surface", async () => {
  const built = buildApp(testConfig({ dataDir: mkdtempSync(join(tmpdir(), "fixed-harness-model-")) }));
  const server = createInsecureTestServer(built.app, {
    config: built.config,
    harnessId: "alego",
    harnessIds: ["alego"],
    harnessModelIds: { alego: ["deepseek-v4-flash"] },
    baseModelDefault: "deepseek-v4-flash",
    admin: built.admin,
    auditLog: built.auditLog,
  });
  server.listen(0);
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;
  try {
    const response = await fetch(`${base}/v1/runtime-config?principalId=alice&scopeId=personal%3Aalice`);
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      modelsByHarness: Record<string, string[]>;
      modelCatalog: Record<string, { name: string; provider: string }>;
    };
    assert.deepEqual(body.modelsByHarness, { alego: ["deepseek-v4-flash"] });
    assert.deepEqual(body.modelCatalog["deepseek-v4-flash"], {
      name: "deepseek-v4-flash",
      provider: "alego",
    });

    const rejected = await fetch(`${base}/v1/runtime-config`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        principalId: "alice",
        scopeId: "personal:alice",
        harnessId: "alego",
        modelId: "claude-opus-4-8",
      }),
    });
    assert.equal(rejected.status, 400);
    assert.equal(((await rejected.json()) as { error: string }).error, "model_not_supported");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await built.runtime.stop();
  }
});

test("a web turn can request the harness-owned Alego model", async () => {
  const mockHarness = createMockHarness();
  const alegoHarness = { ...mockHarness, profile: { ...mockHarness.profile, id: "alego" } };
  const built = buildApp(
    testConfig({
      dataDir: mkdtempSync(join(tmpdir(), "alego-web-turn-")),
      harness: "alego",
      alegoModel: "deepseek-v4-flash",
      backgroundWorkEnabled: false,
    }),
    {
      replaceHarnesses: true,
      harnesses: [alegoHarness],
      harnessModelIds: { alego: ["deepseek-v4-flash"] },
    },
  );
  try {
    const turn = await built.app.turn({
      surface: "web",
      actor: { externalId: "alice" },
      conversation: { kind: "dm", threadRef: "web:alice:alego-model" },
      text: "hello",
      model: "deepseek-v4-flash",
      async: true,
    });
    assert.equal(turn.status, "queued");
  } finally {
    await built.runtime.stop();
  }
});
