import { mock, test } from "node:test";
import assert from "node:assert/strict";

const events: string[] = [];
let startupFailure: Error | undefined;
let webStartupFailure: Error | undefined;
let agentStopFailure: Error | undefined;
let blockQmStop = false;
let webStartOptions: { host: string; port: number; corePort: number; cookieAuth: boolean } | undefined;
let releaseQmStop: () => void = () => {};
let qmStopped = Promise.resolve();

mock.module("../src/config.ts", {
  namedExports: {
    hostEnvironment: () => ({}),
    loadConfig: () => ({}),
  },
});

mock.module("../src/harness/alego-agent-runtime.ts", {
  namedExports: {
    createTransientAlegoRuntime: async () => ({
      agents: {},
      stop: async () => {
        events.push("agent");
        if (agentStopFailure) throw agentStopFailure;
      },
    }),
  },
});

mock.module("../src/harness/alego-harness.ts", {
  namedExports: {
    alegoHarnessConfigOptions: () => ({}),
    createAlegoHarness: () => ({}),
  },
});

mock.module("../src/alego-web-ui-runtime.ts", {
  namedExports: {
    startAlegoWebUi: async (options: typeof webStartOptions) => {
      webStartOptions = options;
      if (webStartupFailure) throw webStartupFailure;
      return {
        stop: async () => {
          events.push("web");
        },
      };
    },
  },
});

mock.module("../src/runtime.ts", {
  namedExports: {
    startQm: async () => {
      if (startupFailure) throw startupFailure;
      return {
        address: { port: 49152 },
        stop: async () => {
          events.push("qm-start");
          if (blockQmStop) await qmStopped;
          events.push("qm-end");
        },
      };
    },
  },
});

const { apply } = await import("../src/alego-plugin.ts");

const pluginConfig = {
  provider: "deepseek-official",
  model: "deepseek-v4-flash",
  host: "127.0.0.1",
  port: 8080,
  dataDir: "./data/qm",
  orgId: "default-org",
  backgroundWork: false,
  allowUnauthenticatedCore: true,
  env: {},
};

test("plugin shutdown stops web ingress, drains QM, then disposes the transient Agent runtime", async () => {
  events.length = 0;
  blockQmStop = true;
  qmStopped = new Promise<void>((resolve) => {
    releaseQmStop = resolve;
  });
  let dispose: (() => Promise<void>) | undefined;
  const ctx = {
    attachments: {},
    llm: {},
    effect: async (effect: () => Promise<() => Promise<void>>) => {
      dispose = await effect();
    },
  };
  await apply(ctx as never, pluginConfig);
  assert.equal(webStartOptions?.host, "127.0.0.1");
  assert.equal(webStartOptions?.port, 8080);
  assert.equal(webStartOptions?.corePort, 49152);
  assert.equal(webStartOptions?.cookieAuth, true);
  assert.ok(dispose);
  const stopping = dispose();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(events, ["web", "qm-start"]);
  releaseQmStop();
  await stopping;
  assert.deepEqual(events, ["web", "qm-start", "qm-end", "agent"]);
  blockQmStop = false;
});

test("plugin startup preserves both the QM failure and a cleanup failure", async () => {
  events.length = 0;
  startupFailure = new Error("bind failed");
  agentStopFailure = new Error("dispose failed");
  const ctx = {
    attachments: {},
    llm: {},
    effect: async (effect: () => Promise<() => Promise<void>>) => effect(),
  };
  await assert.rejects(
    apply(ctx as never, pluginConfig),
    (error: AggregateError) =>
      error instanceof AggregateError &&
      error.errors[0] === startupFailure &&
      error.errors[1] === agentStopFailure &&
      error.cause === startupFailure &&
      error.message === "Alego QM startup and cleanup failed",
  );
  startupFailure = undefined;
  agentStopFailure = undefined;
});

test("a non-loopback surface keeps local cookie auth disabled", async () => {
  events.length = 0;
  let dispose: (() => Promise<void>) | undefined;
  const ctx = {
    attachments: {},
    llm: {},
    effect: async (effect: () => Promise<() => Promise<void>>) => {
      dispose = await effect();
    },
  };
  await apply(ctx as never, {
    ...pluginConfig,
    host: "0.0.0.0",
    coreSigningSecret: "external-core-secret",
  });
  assert.equal(webStartOptions?.cookieAuth, false);
  assert.ok(dispose);
  await dispose();
});

test("a web UI startup failure stops the internal QM runtime before the Agent runtime", async () => {
  events.length = 0;
  webStartupFailure = new Error("surface bind failed");
  const ctx = {
    attachments: {},
    llm: {},
    effect: async (effect: () => Promise<() => Promise<void>>) => effect(),
  };
  await assert.rejects(apply(ctx as never, pluginConfig), webStartupFailure);
  assert.deepEqual(events, ["qm-start", "qm-end", "agent"]);
  webStartupFailure = undefined;
});
