import AgentRegistry from "@singula-ai/alego-agent";
import LlmRuntime, { LlmAdapter, type GenerateOptions, type StreamChunk } from "@singula-ai/alego-llm";
import SessionStore from "@singula-ai/alego-session";
import SystemPrompt from "@singula-ai/alego-system-prompt";
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
}

type CordisPlugin = Parameters<Context["plugin"]>[0];

async function runtimePlugin(name: string): Promise<CordisPlugin> {
  const imported = (await import(`@singula-ai/${name}`)) as unknown;
  if (!imported || typeof imported !== "object" || !("default" in imported)) {
    throw new Error(`@singula-ai/${name} has no default plugin export`);
  }
  return (imported as { default: CordisPlugin }).default;
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
    const [ToolRuntime, AgentLoop] = await Promise.all([
      runtimePlugin("alego-tools"),
      runtimePlugin("alego-agent-loop"),
    ]);
    await context.plugin(LlmRuntime);
    await context.plugin(SessionStore);
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
