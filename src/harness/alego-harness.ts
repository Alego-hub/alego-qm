import { randomUUID } from "node:crypto";
import type { AgentHandle, AgentRegistry } from "@singula-ai/alego-agent";
import type { AttachmentStore, ImageAttachmentRef } from "@singula-ai/alego-attachment";
import {
  BlockAssembler,
  CallId,
  createAssistantMessage,
  createToolResultMessage,
  createUserMessage,
  type ContentBlock,
  type LlmCallConfig,
  type TokenUsage,
} from "@singula-ai/alego-llm";
import { SessionId, type SessionEvent } from "@singula-ai/alego-session";
import type { Context } from "@singula-ai/cordis";
import type { Config } from "../config.ts";
import type { LlmCallUsage, NewTapeRecord } from "../sessions/session-store.ts";
import { NonRetryableTurnError } from "../core/turn-error.ts";
import { parseSecurityScreenVerdict, SECURITY_SCREEN_SYSTEM_PROMPT } from "../security/security-posture.ts";
import { countTokens } from "../util/tokens.ts";
import { swallow } from "../util/errors.ts";
import { startSignalPoll, type RunSignalStore } from "../runs/run-signal-store.ts";
import type { McpToolDescriptor } from "../mcp/mcp-tool-service.ts";
import {
  defineHarness,
  type Harness,
  type HarnessCompactInput,
  type HarnessDetectInput,
  type HarnessDetectResult,
  type HarnessTurnInput,
  type HarnessTurnResult,
} from "./harness.ts";
import {
  APPROVAL_SUMMARY_PROMPT,
  buildDetectionPrompt,
  CONTEXT_COMPACTION_PROMPT,
  parseDetectVerdict,
  renderDetectPrompt,
  sanitizeTitle,
  TITLE_GENERATION_PROMPT,
  titleUserPrompt,
} from "./pi-harness.ts";
import { compactTranscript, deterministicCompactSummary, estimateHistoryTokens } from "./context-compaction.ts";
import { coreToolOptions, createPiTools, type PiToolsOptions, type ToolContextRef } from "./pi-tools.ts";
import { ELIDED_IMAGE_TEXT, planTapeSeed } from "./tape-fold.ts";
import { recordedMessageTimestamps, reconstructMessagesFromHistory, type PiReplayMessage } from "./replay.ts";
import { createGrindMeter, meterGrindCall } from "./grind.ts";
import { enforceGoal, goalSteeringNote, meterGoalCall, type GoalRecord } from "./goal.ts";

interface AlegoToolExecution {
  callId: string;
  signal: AbortSignal;
  concludeTurn(): void;
}

interface AlegoToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  output: {
    schema: { type: "string" };
    render(args: unknown, value: string): ContentBlock[];
  };
  execute(args: unknown, execution: AlegoToolExecution): Promise<string>;
}

type AlegoScopedContext = Context & {
  tools: {
    restrict(restriction: { allow: readonly string[] }): unknown;
    register(definition: AlegoToolDefinition): unknown;
  };
};

interface AlegoLlm {
  stream(options: {
    provider: string;
    model: string;
    messages: ReturnType<typeof createUserMessage>[];
    system?: string;
    maxTokens?: number;
    signal?: AbortSignal;
  }): AsyncIterable<Parameters<BlockAssembler["push"]>[0]>;
}

export interface AlegoRuntimeContext {
  agents: AgentRegistry;
  attachments: AttachmentStore;
  llm: AlegoLlm;
}

export interface AlegoHarnessOptions extends AlegoRuntimeContext {
  provider: string;
  model: string;
  maxTokens?: number;
  signals?: RunSignalStore;
  toolOptions?: PiToolsOptions;
}

type PiToolResult = {
  content?: Array<{ type?: string; text?: string }>;
  details?: unknown;
  terminate?: boolean;
};

type RawSchema = Record<string, unknown>;
type WithoutPosition<Event> = Event extends SessionEvent ? Omit<Event, "seq" | "time"> : never;
type SessionEventInput = WithoutPosition<SessionEvent>;
type AlegoSeedMessage =
  { role: "user"; content: ContentBlock[]; timestamp: number } | Exclude<PiReplayMessage, { role: "user" }>;
type ReplayUserBlock =
  | { type: "text"; text: string }
  | { type: "image"; data?: string; mimeType?: string; artifactRef?: string; omitted?: boolean };

function schemaType(value: unknown): string | undefined {
  return typeof value === "string" &&
    ["object", "array", "string", "number", "integer", "boolean", "null"].includes(value)
    ? value
    : undefined;
}

export function alegoToolSchema(input: unknown): RawSchema {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const source = input as RawSchema;
  const type = schemaType(source.type);
  let branches: unknown[] | undefined;
  if (Array.isArray(source.oneOf)) branches = source.oneOf;
  else if (Array.isArray(source.anyOf)) branches = source.anyOf;
  else if (Array.isArray(source.type)) branches = source.type.map((member) => ({ type: member }));
  const annotations = Object.fromEntries(
    ["description", "title", "default", "examples"].flatMap((key) =>
      source[key] === undefined ? [] : [[key, structuredClone(source[key])]],
    ),
  );
  if (branches?.length === 1) return { ...annotations, ...alegoToolSchema(branches[0]) };
  if (branches?.length) return { ...annotations, oneOf: branches.map(alegoToolSchema) };
  if (!type) return annotations;
  const result: RawSchema = { ...annotations, type };
  if (type === "object") {
    if (source.properties && typeof source.properties === "object" && !Array.isArray(source.properties)) {
      result.properties = Object.fromEntries(
        Object.entries(source.properties as RawSchema).map(([key, value]) => [key, alegoToolSchema(value)]),
      );
    }
    if (Array.isArray(source.required)) result.required = source.required.filter((value) => typeof value === "string");
    if (source.additionalProperties !== undefined) result.additionalProperties = source.additionalProperties !== false;
  }
  if (type === "array" && source.items && !Array.isArray(source.items)) result.items = alegoToolSchema(source.items);
  if (["string", "number", "integer", "boolean", "null"].includes(type)) {
    if (Array.isArray(source.enum)) result.enum = structuredClone(source.enum);
    if (source.const !== undefined) result.const = structuredClone(source.const);
  }
  return result;
}

function piResultText(result: PiToolResult): string {
  const text = (result.content ?? [])
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n");
  if (text) return text;
  if (result.details === undefined) return "";
  try {
    return JSON.stringify(result.details);
  } catch {
    return String(result.details);
  }
}

function bridgeTools(ref: ToolContextRef, options: PiToolsOptions): AlegoToolDefinition[] {
  return createPiTools(ref, options).map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: alegoToolSchema(tool.parameters),
    output: {
      schema: { type: "string" },
      render: (_args, value) => [{ type: "text", text: value }],
    },
    async execute(args, execution) {
      ref.abortSignal = execution.signal;
      const result = (await (
        tool.execute as unknown as (callId: string, params: unknown, signal?: AbortSignal) => Promise<PiToolResult>
      )(execution.callId, args, execution.signal)) as PiToolResult;
      if (result.terminate || ref.pausedOnApproval || ref.silentRequested) execution.concludeTurn();
      return piResultText(result);
    },
  }));
}

function nextTime(last: number, candidate: number | undefined): number {
  const value = Number.isFinite(candidate) ? Math.floor(candidate!) : Date.now();
  return Math.max(last, value);
}

function piAssistantContent(message: Extract<PiReplayMessage, { role: "assistant" }>): ContentBlock[] {
  return message.content.map((block) =>
    block.type === "text"
      ? { type: "text", text: block.text }
      : {
          type: "tool-call",
          id: CallId(block.id),
          name: block.name,
          arguments: JSON.stringify(block.arguments),
        },
  );
}

export function createAlegoSeed(
  messages: readonly AlegoSeedMessage[],
  provider: string,
  model: string,
): SessionEvent[] {
  const events: SessionEvent[] = [];
  const callSeqs = new Map<string, number>();
  let time = 0;
  let turn = 0;
  let step = 0;
  let openTurn = false;
  let openStepActive = false;
  let assistantInStep = false;
  const append = (event: SessionEventInput, candidate?: number): number => {
    time = nextTime(time, candidate);
    const seq = events.length;
    events.push({ ...event, seq, time } as SessionEvent);
    return seq;
  };
  const closeStep = (candidate?: number): void => {
    if (!openTurn || !openStepActive) return;
    append({ type: "step/end", data: { turn, step } }, candidate);
    openStepActive = false;
    assistantInStep = false;
  };
  const closeTurn = (candidate?: number): void => {
    if (!openTurn) return;
    closeStep(candidate);
    append({ type: "turn/end", data: { turn, reason: { kind: "completed" } } }, candidate);
    openTurn = false;
  };
  const openStep = (candidate?: number): void => {
    if (!openTurn) {
      turn += 1;
      step = 0;
      append({ type: "turn/start", data: { turn } }, candidate);
      openTurn = true;
    }
    step += 1;
    append({ type: "step/start", data: { turn, step } }, candidate);
    openStepActive = true;
  };
  for (const message of messages) {
    if (message.role === "user") {
      closeTurn(message.timestamp);
      openStep(message.timestamp);
      append(
        {
          type: "user/message",
          data: createUserMessage({ content: message.content, source: { kind: "user" } }),
          surfaceOp: "append",
        },
        message.timestamp,
      );
      continue;
    }
    if (!openTurn) continue;
    if (message.role === "assistant") {
      if (assistantInStep) {
        closeStep(message.timestamp);
        openStep(message.timestamp);
      }
      const content = piAssistantContent(message);
      append(
        {
          type: "assistant/message",
          data: {
            turn,
            step,
            message: createAssistantMessage({ content, source: { provider, model } }),
          },
          surfaceOp: "append",
          sourceEventSeqs: [],
        },
        message.timestamp,
      );
      assistantInStep = true;
      const calls = content.filter((block) => block.type === "tool-call");
      for (const call of calls) {
        const seq = append(
          {
            type: "tool/call",
            data: { turn, step, callId: call.id, name: call.name, arguments: call.arguments },
          },
          message.timestamp,
        );
        callSeqs.set(call.id, seq);
      }
      if (calls.length === 0) closeTurn(message.timestamp);
      continue;
    }
    if (!openTurn || !openStepActive) continue;
    const callId = CallId(message.toolCallId);
    append(
      {
        type: "tool/result",
        data: {
          turn,
          step,
          message: createToolResultMessage({ callId, content: message.content, isError: message.isError }),
        },
        surfaceOp: "append",
        ...(callSeqs.has(message.toolCallId) ? { sourceEventSeqs: [callSeqs.get(message.toolCallId)!] } : {}),
      },
      message.timestamp,
    );
  }
  closeTurn(time);
  return events;
}

function replayImageType(value: unknown): value is ImageAttachmentRef["mediaType"] {
  return value === "image/png" || value === "image/jpeg" || value === "image/webp" || value === "image/gif";
}

export async function createAlegoReplaySeed(
  messages: readonly unknown[],
  attachments: AttachmentStore,
  provider: string,
  model: string,
): Promise<SessionEvent[]> {
  const prepared: AlegoSeedMessage[] = [];
  for (const raw of messages) {
    const message = raw as { role?: string; content?: ReplayUserBlock[]; timestamp?: number };
    if (message.role !== "user") {
      prepared.push(raw as Exclude<PiReplayMessage, { role: "user" }>);
      continue;
    }
    const content = Array.isArray(message.content) ? message.content : [];
    const images = content.filter(
      (block): block is ReplayUserBlock & { type: "image"; data: string; mimeType: ImageAttachmentRef["mediaType"] } =>
        block.type === "image" && typeof block.data === "string" && replayImageType(block.mimeType),
    );
    let refs: readonly ImageAttachmentRef[] = [];
    if (images.length) {
      try {
        refs = await attachments.saveImages(
          images.map((image) => ({ data: Buffer.from(image.data, "base64"), mediaType: image.mimeType })),
        );
      } catch (error) {
        swallow("alego: replay images", error);
      }
    }
    let imageIndex = 0;
    prepared.push({
      role: "user",
      timestamp: typeof message.timestamp === "number" ? message.timestamp : Date.now(),
      content: content.map((block): ContentBlock => {
        if (block.type === "text") return block;
        const attachment =
          typeof block.data === "string" && replayImageType(block.mimeType) ? refs[imageIndex++] : undefined;
        return attachment ? { type: "image", attachment } : { type: "text", text: ELIDED_IMAGE_TEXT };
      }),
    });
  }
  return createAlegoSeed(prepared, provider, model);
}

function usageForQm(usage: TokenUsage | undefined): LlmCallUsage | null {
  if (!usage) return null;
  return {
    input: usage.inputTokens,
    output: usage.outputTokens,
    cacheRead: usage.cacheReadTokens ?? 0,
    cacheWrite: usage.cacheWriteTokens ?? 0,
    totalTokens: usage.inputTokens + usage.outputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0),
    costUsd: 0,
  };
}

function assistantText(content: readonly ContentBlock[]): string {
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}

function tapeAssistant(content: readonly ContentBlock[], timestamp: number): PiReplayMessage {
  const replayContent: Extract<PiReplayMessage, { role: "assistant" }>["content"] = [];
  for (const block of content) {
    if (block.type === "text") replayContent.push({ type: "text", text: block.text });
    if (block.type !== "tool-call") continue;
    let args: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(block.arguments) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) args = parsed as Record<string, unknown>;
    } catch {
      args = { raw: block.arguments };
    }
    replayContent.push({ type: "toolCall", id: block.id, name: block.name, arguments: args });
  }
  return {
    role: "assistant",
    content: replayContent,
    timestamp,
    stopReason: "stop",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
  };
}

function tapeToolResult(
  event: Extract<SessionEvent, { type: "tool/result" }>,
  timestamp: number,
  toolName: string,
): PiReplayMessage {
  const block = event.data.message.content[0];
  return {
    role: "toolResult",
    toolCallId: block.toolCallId,
    toolName,
    content: block.content.flatMap((content) =>
      content.type === "text" ? [{ type: "text" as const, text: content.text }] : [],
    ),
    isError: block.isError === true,
    timestamp,
  };
}

function rehydrateGoal(history: HarnessTurnInput["history"]): GoalRecord | null {
  for (let index = history.length - 1; index >= 0; index--) {
    const entry = history[index]!;
    if (entry.type !== "system") continue;
    const payload = entry.payload as { kind?: string; goal?: GoalRecord } | null;
    if (payload?.kind === "goal" && payload.goal) return { ...payload.goal };
  }
  return null;
}

function selectedRoute(options: AlegoHarnessOptions): { provider: string; model: string } {
  return { provider: options.provider, model: options.model };
}

async function oneShotText(
  options: AlegoHarnessOptions,
  system: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<string | undefined> {
  const assembler = new BlockAssembler();
  for await (const chunk of options.llm.stream({
    provider: options.provider,
    model: options.model,
    messages: [createUserMessage({ content: [{ type: "text", text: prompt }], source: { kind: "user" } })],
    ...(system ? { system } : {}),
    ...(options.maxTokens ? { maxTokens: options.maxTokens } : {}),
    ...(signal ? { signal } : {}),
  })) {
    assembler.push(chunk);
  }
  const finish = assembler.finish;
  if (finish.kind === "error" || finish.kind === "aborted") throw new Error(finish.failure.message);
  const text = assistantText(assembler.blocks()).trim();
  return text || undefined;
}

function pluginToolOptions(config: Config, mcpTools?: () => McpToolDescriptor[]): PiToolsOptions {
  return {
    ...coreToolOptions(config),
    ...(mcpTools ? { mcpTools } : {}),
  };
}

export function alegoHarnessConfigOptions(
  config: Config,
  context: AlegoRuntimeContext,
  input: {
    provider: string;
    model: string;
    maxTokens?: number;
    signals?: RunSignalStore;
    mcpTools?: () => McpToolDescriptor[];
  },
): AlegoHarnessOptions {
  return {
    ...context,
    provider: input.provider,
    model: input.model,
    ...(input.maxTokens ? { maxTokens: input.maxTokens } : {}),
    ...(input.signals ? { signals: input.signals } : {}),
    toolOptions: pluginToolOptions(config, input.mcpTools),
  };
}

export function createAlegoHarness(options: AlegoHarnessOptions): Harness {
  const active = new Set<AgentHandle>();
  let closing = false;
  const disposeHandle = async (handle: AgentHandle): Promise<void> => {
    if (!active.delete(handle)) return;
    await handle.dispose();
  };
  return defineHarness(
    {
      id: "alego",
      controlTransport: "in-process",
      toolTransport: "in-process",
      transcriptFormat: "alego-session",
      capabilities: new Set(["abort", "steer", "images"]),
    },
    {
      async runTurn(turn: HarnessTurnInput): Promise<HarnessTurnResult> {
        if (closing) throw new NonRetryableTurnError("the Alego plugin is shutting down");
        const startedAt = Date.now();
        const route = selectedRoute(options);
        const reconstructed = reconstructMessagesFromHistory(turn.history);
        const tapePlan = turn.tapeRows?.length
          ? planTapeSeed(turn.tapeRows, "alego", turn.tapeMode, turn.tapeFold)
          : undefined;
        const replay = (tapePlan?.seed as PiReplayMessage[] | null | undefined) ?? reconstructed;
        const seed = await createAlegoReplaySeed(replay, options.attachments, route.provider, route.model);
        const ref: ToolContextRef = {
          current: turn.tools,
          pendingApprovals: [],
          pausedOnApproval: undefined,
          silentRequested: false,
          pollFire: !!turn.pollFire,
          emit: turn.emit,
          scopeLabel: turn.scopeLabel,
          orgScopeId: turn.orgScopeId,
          screenToolResult: turn.screenToolResult,
          screenExternalContent: turn.screenExternalContent,
          toolApprovalGate: turn.toolApprovalGate,
          goal: rehydrateGoal(turn.history),
          goalRound: 0,
        };
        const meter = createGrindMeter();
        ref.goalMeter = meter;
        let toolCalls = 0;
        let modelCalls = 0;
        let reply = "";
        let userAborted = false;
        let timedOut = false;
        let tapeWriteFailed = false;
        let compileMs = 0;
        let agentFailed = false;
        let agentFailure: unknown;
        let tapeTail: Promise<void> = Promise.resolve();
        let requestTail: Promise<void> = Promise.resolve();
        const requests: Array<{
          config: LlmCallConfig;
          startedAt: number;
          firstAt?: number;
          system?: string;
          tools?: unknown[];
        }> = [];
        const toolNames = new Map<string, string>();
        const recordTape = (record: NewTapeRecord): void => {
          if (!turn.tape) return;
          tapeTail = tapeTail.then(async () => {
            try {
              await turn.tape!(record);
            } catch (error) {
              tapeWriteFailed = true;
              swallow("alego: tape write", error);
            }
          });
        };
        const recordCheckpoint = async (entrySeq: number): Promise<void> => {
          await tapeTail;
          if (!turn.tape || tapeWriteFailed) return;
          try {
            await turn.tape({
              kind: "annotation",
              payload: { subturnEnd: true },
              scopeLabel: turn.scopeLabel,
              entrySeq,
            });
          } catch (error) {
            tapeWriteFailed = true;
            swallow("alego: tape checkpoint", error);
          }
        };
        const userEntry = await turn.emit({
          type: "user",
          payload: {
            text: turn.input,
            ...((turn.triggerTs ?? turn.entryTs) ? { ts: turn.triggerTs ?? turn.entryTs } : {}),
            ...(turn.attachments?.length ? { attachments: turn.attachments } : {}),
          },
          scopeLabel: turn.scopeLabel,
        });
        const imageRefs = turn.images?.length
          ? await options.attachments.saveImages(
              turn.images.map((image) => ({
                data: Buffer.from(image.dataBase64, "base64"),
                mediaType: image.mimeType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
              })),
            )
          : [];
        const activeGoal = ref.goal?.status === "active" ? ref.goal : null;
        const prompt = [activeGoal ? goalSteeringNote(activeGoal) : "", turn.input, turn.environment]
          .filter((part) => part?.trim())
          .join("\n\n");
        const userContent: ContentBlock[] = [
          ...(prompt ? [{ type: "text" as const, text: prompt }] : []),
          ...imageRefs.map((attachment) => ({ type: "image" as const, attachment })),
        ];
        recordTape({
          kind: "message",
          harness: "alego",
          payload: {
            role: "user",
            content: [
              ...(prompt ? [{ type: "text", text: prompt }] : []),
              ...(turn.images ?? []).map((image) => ({
                type: "image",
                ...(image.artifactId ? { artifactRef: image.artifactId } : { data: image.dataBase64 }),
                mimeType: image.mimeType,
              })),
            ],
            timestamp: Date.now(),
          },
          scopeLabel: turn.scopeLabel,
          entrySeq: userEntry.seq,
          meta: {
            bareText: turn.input,
            ...((turn.triggerTs ?? turn.entryTs) ? { ts: (turn.triggerTs ?? turn.entryTs)! } : {}),
          },
        });
        let handle: AgentHandle | undefined;
        let timeout: NodeJS.Timeout | undefined;
        let stopSignals: (() => Promise<void>) | undefined;
        const onCancel = (): void => {
          userAborted = true;
          handle?.agent.cancel({ kind: "user" });
        };
        if (turn.cancel) {
          if (turn.cancel.aborted) onCancel();
          else turn.cancel.addEventListener("abort", onCancel, { once: true });
        }
        try {
          handle = await options.agents.create({
            sessionId: SessionId(`qm-${randomUUID()}`),
            meta: { cwd: process.cwd(), seedLength: seed.length },
            seed,
            ...(turn.cancel ? { signal: turn.cancel } : {}),
            agentOptions: {
              provider: route.provider,
              model: route.model,
              ...(options.maxTokens ? { maxTokens: options.maxTokens } : {}),
            },
            setup: (agentContext) => {
              const scoped = agentContext as unknown as AlegoScopedContext;
              scoped.tools.restrict({ allow: [] });
              scoped.systemPrompt.suppressRuntimeContext();
              scoped.systemPrompt.section({ name: "alego-qm", order: 0, text: turn.systemPrompt, complete: true });
              const tools = bridgeTools(ref, {
                ...options.toolOptions,
                ...(turn.credentialExecServices?.length ? { credentialExecServices: turn.credentialExecServices } : {}),
                ...(turn.readOnly ? { readOnly: true } : {}),
                ...(turn.surfaceTools ? { surfaceTools: true } : {}),
                ...(turn.surfaceName ? { surfaceName: turn.surfaceName } : {}),
              });
              for (const tool of tools) {
                scoped.tools.register(tool);
              }
              scoped.on("agent/request", async (payload, next) => {
                const config = await next();
                const request = payload as { signal: AbortSignal };
                request.signal.throwIfAborted();
                modelCalls += 1;
                requests.push({
                  config,
                  startedAt: Date.now(),
                  system: turn.systemPrompt,
                  tools: tools.map(({ name, description, parameters }) => ({ name, description, parameters })),
                });
                turn.recordModelCall({
                  model: config.model,
                  inputTokens:
                    countTokens(turn.systemPrompt) + estimateHistoryTokens(turn.history) + countTokens(prompt),
                  entryCount: turn.history.length,
                });
                return config;
              });
              scoped.on("agent/error", (payload: { error: unknown }) => {
                agentFailed = true;
                agentFailure = payload.error;
              });
              scoped.on("session/event", (_session, event: SessionEvent) => {
                if (event.type === "assistant/chunk") {
                  const chunk = event.data.chunk;
                  const request = requests.at(-1);
                  if (chunk.type === "text-delta") {
                    if (request && request.firstAt === undefined) {
                      request.firstAt = Date.now();
                      turn.onTextBlockStart?.();
                    }
                    turn.onDelta?.(chunk.text);
                  }
                  return;
                }
                if (event.type === "tool/call") {
                  toolCalls += 1;
                  toolNames.set(event.data.callId, event.data.name);
                  turn.onProgress?.({ toolCalls });
                  return;
                }
                if (event.type === "tool/result") {
                  const callId = event.data.message.source.callId;
                  const resultScope = ref.tapeResultScopes?.get(callId);
                  ref.tapeResultScopes?.delete(callId);
                  recordTape({
                    kind: "message",
                    harness: "alego",
                    payload: tapeToolResult(event, event.time, toolNames.get(callId) ?? "tool"),
                    scopeLabel: resultScope ?? turn.scopeLabel,
                  });
                  toolNames.delete(callId);
                  return;
                }
                if (event.type !== "assistant/message") return;
                const text = assistantText(event.data.message.content);
                reply = text;
                recordTape({
                  kind: "message",
                  harness: "alego",
                  payload: tapeAssistant(event.data.message.content, event.time),
                  scopeLabel: turn.scopeLabel,
                });
                const usage = usageForQm(event.data.usage);
                meterGrindCall(meter, usage, event.data.message.source.model);
                if (ref.goal?.status === "active") meterGoalCall(ref.goal, usage);
                const request = requests.shift();
                if (request && turn.recordLlmRequest) {
                  const endedAt = Date.now();
                  requestTail = requestTail.then(async () => {
                    try {
                      await turn.recordLlmRequest!({
                        turnSeq: null,
                        step: event.data.step - 1,
                        model: request.config.model,
                        promptEnvelope: {
                          provider: request.config.provider,
                          system: request.system,
                          tools: request.tools,
                        },
                        truncated: false,
                        ttftMs: request.firstAt ? request.firstAt - request.startedAt : null,
                        durationMs: endedAt - request.startedAt,
                        usage,
                      });
                    } catch (error) {
                      swallow("alego: model request write", error);
                    }
                  });
                }
                turn.onProgress?.({ toolCalls, ...(usage ? { tokens: usage.output } : {}) });
              });
            },
          });
          compileMs = Date.now() - startedAt;
          active.add(handle);
          if (closing) throw new NonRetryableTurnError("the Alego plugin is shutting down");
          const steeredSeen = recordedMessageTimestamps(turn.history);
          stopSignals =
            options.signals && turn.runId
              ? startSignalPoll(
                  options.signals,
                  turn.runId,
                  {
                    onAbort: async () => onCancel(),
                    onSteer: async (text, ts) => {
                      if (ts && !steeredSeen.has(ts)) {
                        steeredSeen.add(ts);
                        await turn.emit({
                          type: "user",
                          payload: { text, ts, steered: true },
                          scopeLabel: turn.scopeLabel,
                        });
                      }
                      ref.silentRequested = false;
                      handle!.agent.steer(
                        createUserMessage({ content: [{ type: "text", text }], source: { kind: "user" } }),
                      );
                    },
                  },
                  { onError: (error) => swallow("alego: signal poll", error) },
                )
              : undefined;
          const wallMs = turn.turnWallClockMs ?? 0;
          if (wallMs > 0) {
            timeout = setTimeout(() => {
              timedOut = true;
              handle!.agent.cancel({ kind: "hook", reason: "QM turn wall-clock limit" });
            }, wallMs);
          }
          handle.agent.followup(createUserMessage({ content: userContent, source: { kind: "user" } }));
          await handle.agent.whenIdle();
          if (agentFailed) throw agentFailure;
          let waiverNote = "";
          if (ref.goal?.status === "active" && !userAborted && !timedOut) {
            const goal = ref.goal;
            const outcome = await enforceGoal({
              goal,
              meter,
              outcome: "ok" as const,
              ok: "ok" as const,
              toolCalls: () => toolCalls,
              blocked: () => userAborted || timedOut || !!ref.pausedOnApproval || !!ref.pendingApprovals?.length,
              beforePrompt: () => {
                ref.goalRound = (ref.goalRound ?? 0) + 1;
                ref.silentRequested = false;
              },
              prompt: async (note) => {
                handle!.agent.followup(
                  createUserMessage({
                    content: [{ type: "text", text: note }],
                    source: { kind: "plugin", plugin: "alego-qm" },
                  }),
                );
                await handle!.agent.whenIdle();
                if (agentFailed) throw agentFailure;
                return "ok" as const;
              },
            });
            waiverNote = outcome.waiverNote;
          }
          if (timedOut) {
            throw new NonRetryableTurnError(
              `the turn hit its ${Math.round(wallMs / 1000)}-second wall-clock limit and was stopped`,
            );
          }
          if (ref.goal) {
            await turn.emit({
              type: "system",
              payload: { kind: "goal", goal: { ...ref.goal } },
              scopeLabel: turn.scopeLabel,
            });
            if (ref.goal.status !== "active") ref.goal = null;
          }
          const finalReply = [userAborted && !reply.trim() ? "(stopped)" : reply, waiverNote]
            .filter(Boolean)
            .join("\n\n");
          const delivered = ref.silentRequested ? "" : finalReply;
          const finalEntry = await turn.emit({
            type: "assistant",
            payload: { text: delivered },
            scopeLabel: turn.scopeLabel,
          });
          await requestTail;
          await recordCheckpoint(finalEntry.seq);
          return {
            reply: delivered,
            ...(ref.silentRequested ? { silent: true } : {}),
            ...(userAborted ? { stopped: true } : {}),
            ...(ref.pendingApprovals?.length ? { pendingApprovals: ref.pendingApprovals } : {}),
            ...(ref.pausedOnApproval ? { pausedOnApproval: true } : {}),
            modelCalls,
            compileMs,
            ...(tapeWriteFailed ? { tapeWriteFailed: true } : {}),
          };
        } catch (error) {
          if (userAborted) {
            const delivered = reply.trim() || "(stopped)";
            if (ref.goal) {
              await turn.emit({
                type: "system",
                payload: { kind: "goal", goal: { ...ref.goal } },
                scopeLabel: turn.scopeLabel,
              });
              if (ref.goal.status !== "active") ref.goal = null;
            }
            const finalEntry = await turn.emit({
              type: "assistant",
              payload: { text: delivered },
              scopeLabel: turn.scopeLabel,
            });
            await requestTail;
            await recordCheckpoint(finalEntry.seq);
            return {
              reply: delivered,
              stopped: true,
              modelCalls,
              compileMs: compileMs || Date.now() - startedAt,
              ...(tapeWriteFailed ? { tapeWriteFailed: true } : {}),
            };
          }
          throw error;
        } finally {
          if (timeout) clearTimeout(timeout);
          turn.cancel?.removeEventListener("abort", onCancel);
          await stopSignals?.();
          ref.abortSignal = undefined;
          if (handle) await disposeHandle(handle);
          await Promise.all([tapeTail, requestTail]);
        }
      },

      async shouldRespond(detect: HarnessDetectInput): Promise<HarnessDetectResult> {
        try {
          const system = buildDetectionPrompt(detect.reactionGuidance);
          const prompt = renderDetectPrompt(detect);
          detect.recordModelCall({
            model: options.model,
            inputTokens: countTokens(system) + countTokens(prompt),
            entryCount: detect.history.length,
          });
          const output = (await oneShotText(options, system, prompt)) ?? "";
          return parseDetectVerdict(output.trim(), Boolean(detect.reactionGuidance?.trim()));
        } catch {
          return { respond: false };
        }
      },

      async compactHistory(input: HarnessCompactInput): Promise<string> {
        const transcript = compactTranscript(input.history);
        try {
          input.recordModelCall({
            model: options.model,
            inputTokens: countTokens(CONTEXT_COMPACTION_PROMPT) + countTokens(transcript),
            entryCount: input.history.length,
          });
          return (
            (await oneShotText(options, CONTEXT_COMPACTION_PROMPT, transcript)) ??
            deterministicCompactSummary(input.history)
          );
        } catch {
          return deterministicCompactSummary(input.history);
        }
      },

      oneShot: (system, prompt) => oneShotText(options, system, prompt),
      judge: (system, prompt) => oneShotText(options, system, prompt),

      async screenSecurity({ payload, signal, recordModelCall, recordLlmRequest }) {
        try {
          recordModelCall({
            model: options.model,
            inputTokens: countTokens(SECURITY_SCREEN_SYSTEM_PROMPT) + countTokens(payload),
            entryCount: 1,
          });
          await recordLlmRequest?.({
            turnSeq: null,
            step: -1,
            model: options.model,
            promptEnvelope: {
              provider: options.provider,
              system: SECURITY_SCREEN_SYSTEM_PROMPT,
              messages: [{ role: "user", content: payload }],
            },
            truncated: false,
          });
          return parseSecurityScreenVerdict(await oneShotText(options, SECURITY_SCREEN_SYSTEM_PROMPT, payload, signal));
        } catch (error) {
          swallow("alego: security screen", error);
          return undefined;
        }
      },

      async generateTitle(transcript: string): Promise<string | undefined> {
        if (!transcript.trim()) return undefined;
        return sanitizeTitle(await oneShotText(options, TITLE_GENERATION_PROMPT, titleUserPrompt(transcript)));
      },

      async summarizeApproval(command: string, reason: string, purpose?: string): Promise<string | undefined> {
        if (!command.trim()) return undefined;
        const prompt = [
          `Policy flagged this as: ${reason}`,
          purpose ? `Agent's stated purpose: ${purpose}` : "",
          "",
          "Command:",
          command.slice(0, 4000),
        ].join("\n");
        const output = (await oneShotText(options, APPROVAL_SUMMARY_PROMPT, prompt))?.trim();
        if (!output || output === "NONE") return undefined;
        return output.replace(/^["']|["']$/g, "").slice(0, 300);
      },

      async close(): Promise<void> {
        closing = true;
        const entries = [...active];
        for (const entry of entries) entry.agent.cancel({ kind: "disposed" });
        await Promise.all(entries.map(disposeHandle));
      },
    },
  );
}
