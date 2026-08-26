import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Context } from "@singula-ai/cordis";
import Schema from "@singula-ai/schemastery";
import { startAlegoWebUi, type AlegoWebUiRuntime } from "./alego-web-ui-runtime.ts";
import { hostEnvironment, loadConfig } from "./config.ts";
import { createTransientAlegoRuntime } from "./harness/alego-agent-runtime.ts";
import { alegoHarnessConfigOptions, createAlegoHarness } from "./harness/alego-harness.ts";
import { startQm } from "./runtime.ts";

export const name = "alego-qm";
export const inject = ["attachments", "llm"];

export interface Config {
  provider: string;
  model: string;
  maxTokens?: number;
  host: string;
  port: number;
  dataDir: string;
  orgId: string;
  backgroundWork: boolean;
  allowUnauthenticatedCore: boolean;
  coreSigningSecret?: string;
  env: Record<string, string>;
}

export const Config: Schema<Config> = Schema.object({
  provider: Schema.string().min(1).default("deepseek-official"),
  model: Schema.string().min(1).default("deepseek-v4-flash"),
  maxTokens: Schema.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER),
  host: Schema.string().min(1).default("127.0.0.1"),
  port: Schema.number().step(1).min(1).max(65535).default(8080),
  dataDir: Schema.string().min(1).default("./data/qm"),
  orgId: Schema.string().min(1).default("default-org"),
  backgroundWork: Schema.boolean().default(true),
  allowUnauthenticatedCore: Schema.boolean().default(true),
  coreSigningSecret: Schema.string(),
  env: Schema.dict(Schema.string()).default({}),
});

function loopback(host: string): boolean {
  const value = host.trim().toLowerCase();
  return value === "localhost" || value === "::1" || value === "[::1]" || /^127(?:\.\d{1,3}){3}$/.test(value);
}

function packagedSkillDirs(): string[] {
  const roots = [resolve(import.meta.dirname, "../plugins"), resolve(import.meta.dirname, "../../plugins")];
  const root = roots.find(existsSync);
  if (!root) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name, "skills"))
    .filter(existsSync);
}

function qmEnvironment(config: Config): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...hostEnvironment(),
    ...config.env,
    HARNESS: "alego",
    ALEGO_MODEL: config.model,
    PORT: "0",
    DATA_DIR: resolve(config.dataDir),
    ORG_ID: config.orgId,
    BACKGROUND_WORK_ENABLED: config.backgroundWork ? "1" : "0",
  };
  if (config.coreSigningSecret) env.CORE_SIGNING_SECRET = config.coreSigningSecret;
  if (config.allowUnauthenticatedCore) env.ALLOW_UNAUTHENTICATED_CORE = "1";
  else delete env.ALLOW_UNAUTHENTICATED_CORE;
  if (!env.PLUGIN_SKILLS_DIRS) env.PLUGIN_SKILLS_DIRS = packagedSkillDirs().join(",");
  if (config.allowUnauthenticatedCore && !env.CORE_SIGNING_SECRET && !loopback(config.host)) {
    throw new Error("allowUnauthenticatedCore requires a loopback host unless coreSigningSecret is configured");
  }
  return env;
}

export async function apply(ctx: Context, config: Config): Promise<void> {
  await ctx.effect(async () => {
    const env = qmEnvironment(config);
    const qmConfig = loadConfig(env);
    const agentRuntime = await createTransientAlegoRuntime(ctx.llm, [config.provider]);
    let runtime: Awaited<ReturnType<typeof startQm>> | undefined;
    let webUi: AlegoWebUiRuntime | undefined;
    try {
      runtime = await startQm(qmConfig, {
        env,
        host: "127.0.0.1",
        replaceHarnesses: true,
        harnessModelIds: { alego: [config.model] },
        harnesses: ({ signals, mcpTools }) => [
          createAlegoHarness(
            alegoHarnessConfigOptions(
              qmConfig,
              { agents: agentRuntime.agents, attachments: ctx.attachments, llm: ctx.llm },
              {
                provider: config.provider,
                model: config.model,
                ...(config.maxTokens ? { maxTokens: config.maxTokens } : {}),
                signals,
                mcpTools,
              },
            ),
          ),
        ],
      });
      webUi = await startAlegoWebUi({
        env,
        host: config.host,
        port: config.port,
        corePort: runtime.address.port,
        cookieAuth: loopback(config.host),
      });
      const startedRuntime = runtime;
      const startedWebUi = webUi;
      return async () => {
        const failures: unknown[] = [];
        try {
          await startedWebUi.stop();
        } catch (error) {
          failures.push(error);
        }
        try {
          await startedRuntime.stop();
        } catch (error) {
          failures.push(error);
        }
        try {
          await agentRuntime.stop();
        } catch (error) {
          failures.push(error);
        }
        if (failures.length) throw new AggregateError(failures, "Alego QM shutdown failed");
      };
    } catch (error) {
      const failures: unknown[] = [error];
      if (webUi) {
        try {
          await webUi.stop();
        } catch (cleanupError) {
          failures.push(cleanupError);
        }
      }
      if (runtime) {
        try {
          await runtime.stop();
        } catch (cleanupError) {
          failures.push(cleanupError);
        }
      }
      try {
        await agentRuntime.stop();
      } catch (cleanupError) {
        failures.push(cleanupError);
      }
      if (failures.length > 1)
        throw new AggregateError(failures, "Alego QM startup and cleanup failed", {
          cause: error,
        });
      throw error;
    }
  }, "alego-qm.runtime");
}
