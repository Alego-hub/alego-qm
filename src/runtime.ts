import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import type { Config } from "./config.ts";
import { createServer } from "./api/server.ts";
import { buildApp, serverDeps, type BuildAppOverrides, type BuiltApp, type Runtime } from "./app-builder.ts";
import { errMessage } from "./util/errors.ts";
import { slackPluginConfigFromEnv, startSlackPlugin } from "./slack/index.ts";
import { createSlackRuntimeReconciler } from "./surfaces/slack-runtime.ts";

export interface StartQmOptions extends BuildAppOverrides {
  env: NodeJS.ProcessEnv;
  host?: string;
}

export interface QmRuntime extends Runtime {
  readonly built: BuiltApp;
  readonly server: Server;
  readonly address: AddressInfo;
}

function listen(server: Server, port: number, host?: string): Promise<AddressInfo> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error): void => reject(error);
    server.once("error", onError);
    const ready = (): void => {
      server.off("error", onError);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("QM HTTP server did not expose a TCP address"));
        return;
      }
      resolve(address);
    };
    if (host) server.listen(port, host, ready);
    else server.listen(port, ready);
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error && (error as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING") reject(error);
      else resolve();
    });
    server.closeIdleConnections();
  });
}

async function settleShutdown(message: string, operations: readonly Promise<void>[]): Promise<void> {
  const results = await Promise.allSettled(operations);
  const failures = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
  if (failures.length) throw new AggregateError(failures, message);
}

export async function startQm(config: Config, options: StartQmOptions): Promise<QmRuntime> {
  const env = options.env;
  const built = buildApp(config, options);
  const envSlackConfig = slackPluginConfigFromEnv(env);
  const envSlackAttempted = Boolean(env.SLACK_BOT_TOKEN || env.SLACK_APP_TOKEN);
  let slackEnvironmentState: "configured" | "partial" | "absent" = "absent";
  if (envSlackConfig) slackEnvironmentState = "configured";
  else if (envSlackAttempted) slackEnvironmentState = "partial";
  const server = createServer(built.app, serverDeps(config, built, slackEnvironmentState, envSlackConfig?.botToken));
  const slackRuntime = createSlackRuntimeReconciler({
    load: async () => {
      const status = await built.slackInstallation.status();
      const stored = await built.slackInstallation.get();
      if (stored) {
        const dynamic = slackPluginConfigFromEnv({
          ...env,
          SLACK_BOT_TOKEN: stored.botToken,
          SLACK_APP_TOKEN: stored.appToken,
        });
        return dynamic ? { version: stored.version, config: dynamic } : null;
      }
      if (status.managed) return null;
      if (envSlackConfig) return { version: "environment", config: envSlackConfig };
      return null;
    },
    startPlugin: (desired) => startSlackPlugin(desired, built.slackCore),
    onError: (error) => console.error(`[qm] slack plugin reconciliation failed: ${errMessage(error)}`),
  });
  let address: AddressInfo | undefined;
  try {
    await built.config.hydrate?.();
    await built.refreshCustomProviders();
    await built.identity.hydrate();
    await built.deploymentLayerReady;
    built.deploymentLayerRefresh.start();
    built.runtime.start();
    address = await listen(server, config.port, options.host);
    if (config.backgroundWorkEnabled) built.scheduler.start(1000);
    else console.log("[qm] background work disabled; scheduler and runtime loops will not start");
    slackRuntime.start();
  } catch (error) {
    built.scheduler.stop();
    built.deploymentLayerRefresh.stop();
    await Promise.allSettled([closeServer(server), slackRuntime.stop(), built.runtime.stop()]);
    throw error;
  }
  console.log(
    `[qm] listening on ${address.address}:${address.port} (org=${config.orgId}, store=${config.sessionStore}, ` +
      `runStore=${config.runStore}, workers=${config.workers}, backgroundWork=${config.backgroundWorkEnabled})`,
  );
  let stopPromise: Promise<void> | undefined;
  const stop = (): Promise<void> => {
    stopPromise ??= (async () => {
      built.scheduler.stop();
      built.deploymentLayerRefresh.stop();
      await settleShutdown("QM shutdown failed", [closeServer(server), slackRuntime.stop(), built.runtime.stop()]);
    })();
    return stopPromise;
  };
  return {
    built,
    server,
    address,
    start() {},
    stop,
    releaseInFlightRuns: () => built.runtime.releaseInFlightRuns(),
  };
}
