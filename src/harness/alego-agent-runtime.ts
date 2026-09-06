import AgentRegistry from "@singula-ai/alego-agent";
import AgentLoop from "@singula-ai/alego-agent-loop";
import LlmRuntime, { LlmAdapter, type GenerateOptions, type StreamChunk } from "@singula-ai/alego-llm";
import SessionStore from "@singula-ai/alego-session";
import SessionProjections from "@singula-ai/alego-session-projection";
import SystemPrompt from "@singula-ai/alego-system-prompt";
import ToolRuntime from "@singula-ai/alego-tools";
import { Context } from "@singula-ai/cordis";

class HostLlmAdapter extends LlmAdapter {
  private readonly host: LlmRuntime;

  constructor(host: LlmRuntime) {
    super();
    this.host = host;
  }

  stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    return this.host.stream(options);
  }

  override resolveModel(provider: string, model: string, signal?: AbortSignal) {
    return this.host.resolveModelInfo(provider, model, signal);
  }

  override providerRetryPolicy(provider: string) {
    return this.host.providerRetryPolicy(provider);
  }
}

export interface TransientAlegoRuntime {
  agents: AgentRegistry;
  stop(): Promise<void>;
}

export async function createTransientAlegoRuntime(
  hostLlm: LlmRuntime,
  providers: readonly string[],
): Promise<TransientAlegoRuntime> {
  const routes = [...new Set(providers.map((provider) => provider.trim()).filter(Boolean))];
  if (!routes.length) throw new Error("the transient Alego runtime requires at least one provider route");
  const context = new Context();
  try {
    await context.plugin(LlmRuntime);
    await context.plugin(SessionStore);
    await context.plugin(SessionProjections);
    await context.plugin(SystemPrompt);
    await context.plugin(ToolRuntime);
    await context.plugin(AgentRegistry);
    await context.plugin(AgentLoop, { agents: [] });
    context.llm.registerAdapter(routes, new HostLlmAdapter(hostLlm));
    return {
      agents: context.agents,
      stop: () => context.fiber.dispose(),
    };
  } catch (error) {
    await context.fiber.dispose();
    throw error;
  }
}
