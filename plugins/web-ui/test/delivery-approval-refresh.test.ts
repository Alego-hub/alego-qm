import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import type { Agent } from "@earendil-works/pi-agent-core";
import type { ConvCtx } from "../src/conv-types.ts";
import type { PendingApproval, SessionEntry } from "../src/core-bridge.ts";

const dom = new JSDOM('<!doctype html><div id="app"></div><main></main>', { url: "http://localhost/web-ui/" });
Object.defineProperty(dom.window, "matchMedia", {
  value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
});
const globals = {
  window: dom.window,
  document: dom.window.document,
  location: dom.window.location,
  history: dom.window.history,
  localStorage: dom.window.localStorage,
  navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement,
  customElements: dom.window.customElements,
  Node: dom.window.Node,
  Event: dom.window.Event,
  requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
  cancelAnimationFrame: clearTimeout,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
};
for (const [key, value] of Object.entries(globals))
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });

const vite = await createServer({
  root: fileURLToPath(new URL("..", import.meta.url)),
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
});
const { createChatSurface } = await vite.ssrLoadModule("/src/chat.ts");

test.after(() => vite.close());

const entries: SessionEntry[] = [
  { type: "user", payload: { text: "clean it" }, createdAt: 1, seq: 1 },
  {
    type: "tool_call",
    payload: { tool: "execute", command: "rm -r generated" },
    createdAt: 2,
    seq: 2,
    parentSeq: 1,
  },
];

function context(): ConvCtx {
  return {
    pane: false,
    ownsUrl: false,
    container: () => null,
    claimContainer: () => null,
    visible: () => true,
    density: () => "full",
    onDensityChange: () => {},
    ensureDeliveryStream: () => {},
    chat: null,
    composer: {
      state: {
        draft: "",
        attachments: [],
        error: "",
        processingFiles: false,
        dragging: false,
        openMenu: null,
        slashDismissed: false,
        effortLevel: "medium",
        fastMode: undefined,
        pasteView: null,
      },
      refreshRuntimeSelection: async () => {},
    },
  } as unknown as ConvCtx;
}

function deferred(): { promise: Promise<void>; resolve(): void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 20 && !condition(); i++) await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(condition());
}

test("a delivery received while streaming refreshes approvals after idle and clears them on the next terminal state", async () => {
  let transcriptCalls = 0;
  let approvalCalls = 0;
  let approvals: PendingApproval[] = [{ requestId: "a1", command: "rm -r generated", reason: "recursive delete" }];
  const surface = createChatSurface(context(), {
    fetchTranscript: async () => {
      transcriptCalls++;
      return { entries, earlierEntries: 0 };
    },
    fetchApprovals: async () => {
      approvalCalls++;
      return approvals;
    },
  });
  const idle = deferred();
  const agentState = { isStreaming: true, messages: [] };
  const agent = {
    state: agentState,
    waitForIdle: () => idle.promise,
  } as unknown as Agent;
  surface.state.agent = agent;
  surface.state.threadRef = "web:u:1";
  surface.state.sessionId = "s1";
  surface.state.forkSession = {
    id: "s1",
    type: "dm",
    scopeId: "personal:u",
    threadRef: "web:u:1",
    createdAt: 1,
  };

  surface.onDelivery("web:u:1");
  assert.equal(transcriptCalls, 0);
  agentState.isStreaming = false;
  idle.resolve();
  await waitFor(() => transcriptCalls === 1 && approvalCalls === 1 && surface.activePendingApprovals().length === 1);

  approvals = [];
  surface.onDelivery("web:u:1");
  await waitFor(() => transcriptCalls === 2 && approvalCalls === 2 && surface.activePendingApprovals().length === 0);
});

test("a deferred delivery refresh cannot mutate a replacement conversation", async () => {
  let transcriptCalls = 0;
  const surface = createChatSurface(context(), {
    fetchTranscript: async () => {
      transcriptCalls++;
      return { entries, earlierEntries: 0 };
    },
  });
  const idle = deferred();
  const staleState = { isStreaming: true, messages: [] };
  const stale = {
    state: staleState,
    waitForIdle: () => idle.promise,
  } as unknown as Agent;
  const current = {
    state: { isStreaming: false, messages: [] },
    waitForIdle: () => Promise.resolve(),
  } as unknown as Agent;
  surface.state.agent = stale;
  surface.state.threadRef = "web:u:1";
  surface.state.sessionId = "s1";

  surface.onDelivery("web:u:1");
  surface.state.agent = current;
  staleState.isStreaming = false;
  idle.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(transcriptCalls, 0);
});
