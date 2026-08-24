import type { Config } from "./config.ts";
import {
  buildApp as buildAppCore,
  type BuildAppOverrides,
  type BuiltApp,
  type HarnessFactoryDependencies,
} from "./app-builder.ts";
import { createClaudeHarness, claudeHarnessConfigOptions } from "./harness/claude-harness.ts";
import { createCodexHarness, codexHarnessConfigOptions } from "./harness/codex-harness.ts";
import type { Harness } from "./harness/harness.ts";
import { createMockHarness } from "./harness/mock-harness.ts";
import { createOpenCodeHarness, openCodeHarnessConfigOptions } from "./harness/opencode-harness.ts";
import { createPiHarness, piHarnessConfigOptions } from "./harness/pi-harness.ts";

export * from "./app-builder.ts";

export function defaultHarnesses(dependencies: HarnessFactoryDependencies): readonly Harness[] {
  const { config, signals, tasks, mcpTools } = dependencies;
  return [
    createPiHarness({
      ...piHarnessConfigOptions(config),
      resolveBaseModelId: dependencies.resolveBaseModelId,
      resolveProviderKeys: dependencies.resolveProviderKeys,
      signals,
      mcpTools,
    }),
    createOpenCodeHarness({
      ...openCodeHarnessConfigOptions(config),
      signals,
      tasks,
      mcpTools,
      resolveCustomProviders: dependencies.resolveCustomProviders,
    }),
    createCodexHarness({ ...codexHarnessConfigOptions(config), signals, tasks, mcpTools }),
    createClaudeHarness({ ...claudeHarnessConfigOptions(config), signals, tasks, mcpTools }),
    createMockHarness(),
  ];
}

export function buildApp(config: Config, overrides: BuildAppOverrides = {}): BuiltApp {
  return buildAppCore(config, { defaultHarnesses, ...overrides });
}
