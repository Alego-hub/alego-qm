import test from "node:test";
import assert from "node:assert/strict";
import { Session, SessionId, type SessionEvent } from "@singula-ai/alego-session";
import { createAssistantMessage } from "@singula-ai/alego-llm";
import { Config as PluginConfig } from "../src/alego-plugin.ts";
import {
  alegoToolSchema,
  createAlegoHarness,
  createAlegoReplaySeed,
  createAlegoSeed,
} from "../src/harness/alego-harness.ts";
import type { HarnessLlmRequestRecord, HarnessTurnInput } from "../src/harness/harness.ts";
import type { PiReplayMessage } from "../src/harness/replay.ts";
import type { NewEntry, NewTapeRecord } from "../src/sessions/session-store.ts";
import type { ScopeId, SessionEntry } from "../src/types.ts";

test("the Alego plugin schema supplies a safe local default", () => {
  const config = PluginConfig({} as never);
  assert.deepEqual(config, {
    provider: "deepseek-official",
    model: "deepseek-v4-flash",
    host: "127.0.0.1",
    port: 8080,
    dataDir: "./data/qm",
    orgId: "default-org",
    backgroundWork: true,
    allowUnauthenticatedCore: true,
    env: {},
  });
});

test("QM tool schemas are reduced to Alego's accepted JSON Schema subset", () => {
  assert.deepEqual(
    alegoToolSchema({
      $id: "ignored",
      type: "object",
      properties: {
        choice: {
          anyOf: [
            { type: "string", const: "a" },
            { type: "string", const: "b" },
          ],
        },
        count: { type: "integer", minimum: 1, maximum: 5 },
        metadata: { type: "object", additionalProperties: { type: "string" } },
      },
      required: ["choice", 3],
      additionalProperties: false,
    }),
    {
      type: "object",
      properties: {
        choice: {
          oneOf: [
            { type: "string", const: "a" },
            { type: "string", const: "b" },
          ],
        },
        count: { type: "integer" },
        metadata: { type: "object", additionalProperties: true },
      },
      required: ["choice"],
      additionalProperties: false,
    },
  );
  assert.deepEqual(alegoToolSchema({ anyOf: [{ type: "string" }] }), { type: "string" });
});

test("QM replay history becomes a balanced Alego session seed", () => {
  const messages: PiReplayMessage[] = [
    { role: "user", content: [{ type: "text", text: "read it" }], timestamp: 10 },
    {
      role: "assistant",
      content: [{ type: "toolCall", id: "call-1", name: "read", arguments: { path: "README.md" } }],
      timestamp: 11,
      stopReason: "stop",
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
    },
    {
      role: "toolResult",
      toolCallId: "call-1",
      toolName: "read",
      content: [{ type: "text", text: "Alego QM" }],
      isError: false,
      timestamp: 12,
    },
    {
      role: "assistant",
      content: [{ type: "text", text: "It says Alego QM." }],
      timestamp: 13,
      stopReason: "stop",
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
    },
  ];
  const seed = createAlegoSeed(messages, "test-provider", "test-model");
  const session = Session.create(SessionId("seed-test"), seed);
  assert.equal(session.firstLiveSeq, seed.length);
  assert.equal(seed.at(-1)?.type, "turn/end");
  assert.deepEqual(
    seed.filter((event) => event.type === "step/start").map((event) => event.data.step),
    [1, 2],
  );
});

test("taped images become Alego attachment references before replay", async () => {
  const saved: Array<{ data: Uint8Array; mediaType: string }> = [];
  const attachment = {
    attachmentId: "image-1",
    mediaType: "image/png" as const,
    bytes: 1,
    width: 1,
    height: 1,
  };
  const seed = await createAlegoReplaySeed(
    [
      {
        role: "user",
        content: [
          { type: "text", text: "what is this?" },
          { type: "image", data: "AA==", mimeType: "image/png" },
        ],
        timestamp: 10,
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "an image" }],
        timestamp: 11,
        stopReason: "stop",
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
      },
    ],
    {
      async saveImages(inputs: Array<{ data: Uint8Array; mediaType: string }>) {
        saved.push(...inputs);
        return [attachment];
      },
    } as never,
    "test-provider",
    "test-model",
  );
  const user = seed.find((event) => event.type === "user/message");
  assert.equal(saved.length, 1);
  assert.deepEqual(user?.data.content, [
    { type: "text", text: "what is this?" },
    { type: "image", attachment },
  ]);
  assert.doesNotThrow(() => Session.create(SessionId("image-seed"), seed));
});

test("an Alego Agent drives a QM turn and is disposed at the turn boundary", async () => {
  const listeners = new Map<string, (...args: never[]) => unknown>();
  const toolNames: string[] = [];
  const promptSections: unknown[] = [];
  const restrictions: unknown[] = [];
  const entries: SessionEntry[] = [];
  const tape: NewTapeRecord[] = [];
  const modelCalls: Array<{ model: string; inputTokens: number; entryCount: number }> = [];
  const llmRequests: HarnessLlmRequestRecord[] = [];
  const deltas: string[] = [];
  let textStarts = 0;
  let disposed = 0;
  let createdOptions: Record<string, unknown> | undefined;
  let pending = false;
  let emitted = false;
  const agent = {
    followup() {
      pending = true;
    },
    steer() {},
    cancel() {},
    async whenIdle() {
      if (!pending || emitted) return;
      pending = false;
      emitted = true;
      const request = listeners.get("agent/request")!;
      await request(
        { agent, turn: 1, step: 1, signal: new AbortController().signal } as never,
        (() => Promise.resolve({ provider: "test-provider", model: "test-model" })) as never,
      );
      const onEvent = listeners.get("session/event")!;
      onEvent(
        {} as never,
        {
          type: "assistant/chunk",
          seq: 0,
          time: 100,
          data: { turn: 1, step: 1, chunk: { type: "text-delta", index: 0, text: "Alego reply" } },
        } satisfies SessionEvent<"assistant/chunk"> as never,
      );
      onEvent(
        {} as never,
        {
          type: "assistant/message",
          seq: 1,
          time: 101,
          data: {
            turn: 1,
            step: 1,
            message: createAssistantMessage({
              content: [{ type: "text", text: "Alego reply" }],
              source: { provider: "test-provider", model: "test-model" },
            }),
            usage: { inputTokens: 10, outputTokens: 3, cacheReadTokens: 2 },
          },
          surfaceOp: "append",
          sourceEventSeqs: [],
        } satisfies SessionEvent<"assistant/message"> as never,
      );
    },
  };
  const harness = createAlegoHarness({
    provider: "test-provider",
    model: "test-model",
    agents: {
      async create(options: Record<string, unknown>) {
        createdOptions = options;
        const setup = options.setup as (context: unknown) => unknown;
        await setup({
          tools: {
            restrict(value: unknown) {
              restrictions.push(value);
            },
            register(tool: { name: string }) {
              toolNames.push(tool.name);
            },
          },
          systemPrompt: {
            suppressRuntimeContext() {},
            section(value: unknown) {
              promptSections.push(value);
            },
          },
          on(event: string, listener: (...args: never[]) => unknown) {
            listeners.set(event, listener);
            return () => listeners.delete(event);
          },
        });
        return {
          agent,
          async dispose() {
            disposed += 1;
          },
        };
      },
    } as never,
    attachments: { saveImages: async () => [] } as never,
    llm: { stream: async function* () {} },
    toolOptions: {
      mcpTools: () => [
        {
          name: "docs_search",
          serverId: "docs",
          remoteName: "search",
          description: "Search documentation",
          inputSchema: { type: "object", properties: { query: { type: "string" } } },
          readOnly: true,
        },
      ],
    },
  });
  const scope = "org:test" as ScopeId;
  const turn: HarnessTurnInput = {
    session: { id: "session-1" } as HarnessTurnInput["session"],
    input: "hello",
    systemPrompt: "Use QM tools.",
    history: [],
    tools: {} as HarnessTurnInput["tools"],
    scopeLabel: scope,
    orgScopeId: scope,
    readOnly: true,
    emit: async (entry: NewEntry) => {
      const saved = {
        ...entry,
        sessionId: "session-1",
        seq: entries.length,
        createdAt: Date.now(),
      } as SessionEntry;
      entries.push(saved);
      return saved;
    },
    tape: async (record) => void tape.push(record),
    recordModelCall: (record) => void modelCalls.push(record),
    recordLlmRequest: (record) => void llmRequests.push(record),
    onDelta: (text) => void deltas.push(text),
    onTextBlockStart: () => void (textStarts += 1),
  };
  const result = await harness.turns.runTurn(turn);
  assert.equal(result.reply, "Alego reply");
  assert.equal(result.modelCalls, 1);
  assert.equal(disposed, 1);
  assert.ok(createdOptions);
  assert.equal((createdOptions.agentOptions as { provider: string }).provider, "test-provider");
  assert.deepEqual(restrictions, [{ allow: [] }]);
  assert.deepEqual(promptSections, [{ name: "alego-qm", order: 0, text: "Use QM tools.", complete: true }]);
  assert.ok(toolNames.includes("memory"));
  assert.ok(toolNames.includes("finish_silently"));
  assert.ok(toolNames.includes("docs_search"));
  assert.deepEqual(deltas, ["Alego reply"]);
  assert.equal(textStarts, 1);
  assert.deepEqual(
    entries.filter((entry) => entry.type === "user" || entry.type === "assistant").map((entry) => entry.type),
    ["user", "assistant"],
  );
  assert.equal(tape.filter((record) => record.kind === "message").length, 2);
  const llmRequest = llmRequests[0];
  assert.ok(llmRequest);
  assert.equal(llmRequest.usage?.totalTokens, 15);
  assert.equal((llmRequest.promptEnvelope as { provider: string }).provider, "test-provider");
  assert.equal(modelCalls[0]?.model, "test-model");
  await harness.turns.close?.();
});

test("Alego Agent failures reject the QM turn", async () => {
  const listeners = new Map<string, (...args: never[]) => unknown>();
  const failure = new Error("provider failed");
  let disposed = 0;
  const agent = {
    followup() {},
    steer() {},
    cancel() {},
    async whenIdle() {
      listeners.get("agent/error")?.({ error: failure } as never);
    },
  };
  const harness = createAlegoHarness({
    provider: "test-provider",
    model: "test-model",
    agents: {
      async create(options: Record<string, unknown>) {
        const setup = options.setup as (context: unknown) => unknown;
        await setup({
          tools: { restrict() {}, register() {} },
          systemPrompt: { suppressRuntimeContext() {}, section() {} },
          on(event: string, listener: (...args: never[]) => unknown) {
            listeners.set(event, listener);
            return () => listeners.delete(event);
          },
        });
        return {
          agent,
          async dispose() {
            disposed += 1;
          },
        };
      },
    } as never,
    attachments: { saveImages: async () => [] } as never,
    llm: { stream: async function* () {} },
  });
  const entries: SessionEntry[] = [];
  const scope = "org:test" as ScopeId;
  await assert.rejects(
    harness.turns.runTurn({
      session: { id: "session-error" } as HarnessTurnInput["session"],
      input: "hello",
      systemPrompt: "Use QM tools.",
      history: [],
      tools: {} as HarnessTurnInput["tools"],
      scopeLabel: scope,
      orgScopeId: scope,
      emit: async (entry: NewEntry) => {
        const saved = {
          ...entry,
          sessionId: "session-error",
          seq: entries.length,
          createdAt: Date.now(),
        } as SessionEntry;
        entries.push(saved);
        return saved;
      },
      recordModelCall() {},
    }),
    failure,
  );
  assert.deepEqual(
    entries.map((entry) => entry.type),
    ["user"],
  );
  assert.equal(disposed, 1);
  await harness.turns.close?.();
});
