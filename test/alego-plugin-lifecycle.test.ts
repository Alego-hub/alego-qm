import { mock, test } from "node:test";
import assert from "node:assert/strict";

const events: string[] = [];
let startupFailure: Error | undefined;
let agentStopFailure: Error | undefined;
let releaseQmStop: () => void = () => {};
const qmStopped = new Promise<void>((resolve) => {
  releaseQmStop = resolve;
});

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

mock.module("../src/runtime.ts", {
  namedExports: {
    startQm: async () => {
      if (startupFailure) throw startupFailure;
      return {
        stop: async () => {
          events.push("qm-start");
          await qmStopped;
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
  port: 0,
  dataDir: "./data/qm",
  orgId: "default-org",
  backgroundWork: false,
  allowUnauthenticatedCore: true,
  env: {},
};

test("plugin shutdown drains QM before disposing the transient Agent runtime", async () => {
  let dispose: (() => Promise<void>) | undefined;
  const ctx = {
    attachments: {},
    llm: {},
    effect: async (effect: () => Promise<() => Promise<void>>) => {
      dispose = await effect();
    },
  };
  await apply(ctx as never, pluginConfig);
  assert.ok(dispose);
  const stopping = dispose();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(events, ["qm-start"]);
  releaseQmStop();
  await stopping;
  assert.deepEqual(events, ["qm-start", "qm-end", "agent"]);
});

test("plugin startup preserves both the QM failure and a cleanup failure", async () => {
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
      error.cause === agentStopFailure &&
      error.message === "Alego QM startup and cleanup failed",
  );
});
