import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NON_INTERACTIVE_FAST_MODE,
  NON_INTERACTIVE_THINKING_LEVEL,
  turnModelOptions,
  validateWebTurnModelOptions,
  webTurnRuntimeModelRefusal,
} from "../src/core/turn-options.ts";

test("triggered turns default to extra-high thinking and non-fast mode", () => {
  assert.deepEqual(turnModelOptions({ triggered: true }), {
    thinkingLevel: NON_INTERACTIVE_THINKING_LEVEL,
    fastMode: NON_INTERACTIVE_FAST_MODE,
  });
});

test("explicit turn model options win over triggered defaults", () => {
  assert.deepEqual(turnModelOptions({ triggered: true, thinkingLevel: "low", fastMode: true }), {
    thinkingLevel: "low",
    fastMode: true,
  });
});

test("web model controls are bounded by admin configuration", () => {
  assert.equal(
    validateWebTurnModelOptions({ model: "claude-sonnet-4-6" }, ["claude-opus-4-8"]),
    "that model is not enabled for the web UI",
  );
  assert.equal(validateWebTurnModelOptions({ thinkingLevel: "infinite" }, null), "unsupported thinking level");
  assert.equal(validateWebTurnModelOptions({ model: "claude-opus-4-8", thinkingLevel: "high" }, null), null);
});

test("a harness-owned model bypasses the QM provider registry only when explicitly enabled", () => {
  assert.equal(
    validateWebTurnModelOptions(
      { model: "deepseek-v4-flash" },
      ["deepseek-v4-flash"],
      { anthropic: false, openai: false, openrouter: false },
      ["deepseek-v4-flash"],
    ),
    null,
  );
  assert.equal(
    validateWebTurnModelOptions(
      { model: "unconfigured" },
      ["deepseek-v4-flash"],
      { anthropic: false, openai: false, openrouter: false },
      ["deepseek-v4-flash"],
    ),
    "that model is not enabled for the web UI",
  );
});

test("a resolved scope override outside the configured picker is refused, the org default is not", () => {
  const picker = ["claude-sonnet-4-6"];
  assert.equal(
    webTurnRuntimeModelRefusal("claude-opus-4-8", "claude-sonnet-4-6", picker),
    "that model is not enabled for the web UI",
  );
  assert.equal(webTurnRuntimeModelRefusal("claude-sonnet-4-6", "claude-opus-4-8", picker), null);
  assert.equal(webTurnRuntimeModelRefusal("claude-opus-4-8", "claude-opus-4-8", picker), null);
  assert.equal(webTurnRuntimeModelRefusal("claude-opus-4-8", "claude-sonnet-4-6", null), null);
  assert.equal(webTurnRuntimeModelRefusal("claude-opus-4-8", "claude-sonnet-4-6", []), null);
});

test("interactive turns do not force model options", () => {
  assert.deepEqual(turnModelOptions({}), {});
});

test("a triggered turn with an explicit low thinking level overrides the xhigh trigger default", () => {
  assert.deepEqual(turnModelOptions({ triggered: true, thinkingLevel: "low" }), {
    thinkingLevel: "low",
    fastMode: NON_INTERACTIVE_FAST_MODE,
  });
});
