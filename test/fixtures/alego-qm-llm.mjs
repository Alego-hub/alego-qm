import assert from "node:assert/strict";
import { appendFile } from "node:fs/promises";
import { LlmAdapter } from "@singula-ai/alego-llm";

class QmFixtureAdapter extends LlmAdapter {
  constructor(capturePath) {
    super();
    this.capturePath = capturePath;
  }

  async *stream(options) {
    const { messages, tools = [], signal } = options;
    await appendFile(this.capturePath, `${JSON.stringify({ messages, tools, maxTokens: options.maxTokens })}\n`);
    const lastUser = messages.findLastIndex((message) => message.source.kind === "user");
    const prompt = messages[lastUser]?.content.find((block) => block.type === "text")?.text ?? "";
    const toolResults = messages
      .slice(lastUser + 1)
      .flatMap((message) => message.content.filter((block) => block.type === "tool-result"));
    const recall = prompt.includes("[qm-e2e:recall]");
    const remember = prompt.includes("[qm-e2e:remember]");
    if ((remember || recall) && toolResults.length === 0) {
      assert.ok(tools.some((tool) => tool.name === "memory"));
      assert.ok(tools.every((tool) => !["bash", "run_code", "write_file"].includes(tool.name)));
      if (recall) {
        assert.ok(messages.slice(0, lastUser).some((message) => message.role === "assistant"));
        assert.ok(messages.slice(0, lastUser).some((message) => message.source.kind === "tool"));
      }
      const id = `qm-memory-${lastUser}`;
      const args = JSON.stringify(
        recall ? { action: "read" } : { action: "remember", facts: ["The QA marker is cobalt-731."] },
      );
      yield { type: "block-start", index: 0, blockType: "tool-call" };
      yield { type: "tool-call-delta", index: 0, id, name: "memory", argumentsDelta: args };
      yield { type: "block-end", index: 0, block: { type: "tool-call", id, name: "memory", arguments: args } };
      yield { type: "usage", usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 2 } };
      yield { type: "finish", reason: { kind: "tool-calls" } };
      return;
    }
    if (remember || recall) {
      assert.ok(
        toolResults.every((result) => !result.isError),
        JSON.stringify(toolResults),
      );
      if (recall) assert.match(JSON.stringify(toolResults), /cobalt-731/);
    }
    const text = prompt.includes("[qm-e2e:abort]") ? "Waiting for cancellation" : "QM E2E cobalt-731";
    yield { type: "block-start", index: 0, blockType: "text" };
    yield { type: "text-delta", index: 0, text };
    if (prompt.includes("[qm-e2e:abort]")) {
      await new Promise((resolve) => {
        if (signal.aborted) resolve();
        else signal.addEventListener("abort", resolve, { once: true });
      });
      signal.throwIfAborted();
    }
    yield { type: "block-end", index: 0, block: { type: "text", text } };
    yield { type: "usage", usage: { inputTokens: 20, outputTokens: 7, cacheReadTokens: 3 } };
    yield { type: "finish", reason: { kind: "stop" } };
  }
}

export const name = "qm-fixture-llm";
export const inject = ["llm"];

export function apply(ctx, config) {
  ctx.llm.registerAdapter(["qm-fixture"], new QmFixtureAdapter(config.capturePath));
}
