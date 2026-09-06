import test from "node:test";
import assert from "node:assert/strict";
import LlmRuntime, {
  LlmAdapter,
  createUserMessage,
  type GenerateOptions,
  type StreamChunk,
} from "@singula-ai/alego-llm";
import { SessionId, type SessionEvent } from "@singula-ai/alego-session";
import { Context } from "@singula-ai/cordis";
import { createTransientAlegoRuntime } from "../src/harness/alego-agent-runtime.ts";

test("the transient runtime preserves host model defaults and drives real Alego tools", async () => {
  const requests: GenerateOptions[] = [];
  const host = new Context();
  await host.plugin(LlmRuntime);
  class Adapter extends LlmAdapter {
    override async resolveModel(provider: string, model: string) {
      return { provider, id: model, name: model, defaultMaxTokens: 73 };
    }

    async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
      requests.push(options);
      if (options.messages.at(-1)?.source.kind !== "tool") {
        const id = "qa-call" as Extract<StreamChunk, { type: "tool-call-delta" }>["id"];
        yield { type: "block-start", index: 0, blockType: "tool-call" };
        yield { type: "tool-call-delta", index: 0, id, name: "qa_echo", argumentsDelta: '{"value":"echoed"}' };
        yield {
          type: "block-end",
          index: 0,
          block: { type: "tool-call", id, name: "qa_echo", arguments: '{"value":"echoed"}' },
        };
        yield { type: "finish", reason: { kind: "tool-calls" } };
      } else {
        yield { type: "block-start", index: 0, blockType: "text" };
        yield { type: "text-delta", index: 0, text: "finished" };
        yield { type: "block-end", index: 0, block: { type: "text", text: "finished" } };
        yield { type: "finish", reason: { kind: "stop" } };
      }
    }
  }
  host.llm.registerAdapter(["qa"], new Adapter());
  const runtime = await createTransientAlegoRuntime(host.llm, ["qa"]);
  try {
    const events: SessionEvent[] = [];
    const failures: unknown[] = [];
    const handle = await runtime.agents.create({
      sessionId: SessionId("qm-runtime-qa"),
      agentOptions: { provider: "qa", model: "test" },
      setup: (ctx) => {
        ctx.tools.register({
          name: "qa_echo",
          description: "Echo a QA value",
          parameters: { type: "object", properties: { value: { type: "string" } }, required: ["value"] },
          output: { schema: { type: "string" }, render: (_args, value) => [{ type: "text", text: String(value) }] },
          execute: async (args) => (args as { value: string }).value,
        });
        ctx.on("session/event", (_session, event) => void events.push(event));
        ctx.on("agent/error", ({ error }) => void failures.push(error));
      },
    });
    try {
      handle.agent.followup(createUserMessage({ source: { kind: "user" }, content: [{ type: "text", text: "echo" }] }));
      await handle.agent.whenIdle();
      assert.deepEqual(failures, []);
      assert.equal(requests.length, 2);
      assert.ok(requests.every((request) => request.maxTokens === 73));
      assert.deepEqual(
        requests[0]!.tools?.map((tool) => tool.name),
        ["qa_echo"],
      );
      assert.equal(events.filter((event) => event.type === "tool/result").length, 1);
      assert.equal(events.filter((event) => event.type === "assistant/message").length, 2);
    } finally {
      await handle.dispose();
    }
    assert.equal(runtime.agents.get(SessionId("qm-runtime-qa")), undefined);
  } finally {
    await runtime.stop();
    await host.fiber.dispose();
  }
});
