import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";

export interface AlegoWebUiRuntime {
  stop(): Promise<void>;
}

export interface StartAlegoWebUiOptions {
  env: NodeJS.ProcessEnv;
  host: string;
  port: number;
  corePort: number;
  cookieAuth: boolean;
}

function reachableHost(host: string): string {
  const normalized = host.trim().toLowerCase();
  if (normalized === "0.0.0.0") return "127.0.0.1";
  if (normalized === "::" || normalized === "[::]") return "::1";
  return host.trim().replace(/^\[(.*)\]$/, "$1");
}

function bindHost(host: string): string {
  return host.trim().replace(/^\[(.*)\]$/, "$1");
}

function surfaceUrl(host: string, port: number): string {
  const reachable = reachableHost(host);
  const hostname = reachable.includes(":") ? `[${reachable}]` : reachable;
  return `http://${hostname}:${port}`;
}

function outputTail(child: ChildProcess): () => string {
  let output = "";
  const capture = (chunk: Buffer, destination: NodeJS.WriteStream): void => {
    const text = chunk.toString();
    output = `${output}${text}`.slice(-16_384);
    destination.write(chunk);
  };
  child.stdout?.on("data", (chunk: Buffer) => capture(chunk, process.stdout));
  child.stderr?.on("data", (chunk: Buffer) => capture(chunk, process.stderr));
  return () => output.trim();
}

async function waitForHealth(child: ChildProcess, url: string, output: () => string): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Alego web UI exited before becoming healthy${output() ? `: ${output()}` : ""}`);
    }
    const response = await fetch(`${url}/healthz`, { signal: AbortSignal.timeout(1_000) }).catch(() => null);
    if (response?.ok && output().includes("[web-ui] surface on ")) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`Alego web UI did not become healthy on ${url}${output() ? `: ${output()}` : ""}`);
}

function waitForExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolveExit) => child.once("close", () => resolveExit()));
}

async function stopProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = waitForExit(child);
  child.kill("SIGTERM");
  let timeout: NodeJS.Timeout | undefined;
  await Promise.race([
    exited,
    new Promise<void>((resolveWait) => {
      timeout = setTimeout(resolveWait, 2_000);
    }),
  ]);
  if (timeout) clearTimeout(timeout);
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGKILL");
  await exited;
}

export async function startAlegoWebUi(options: StartAlegoWebUiOptions): Promise<AlegoWebUiRuntime> {
  const serverPath = resolve(import.meta.dirname, "../web-ui/server/index.js");
  const url = surfaceUrl(options.host, options.port);
  const child = spawn(process.execPath, [serverPath], {
    env: {
      ...options.env,
      CORE_API_URL: `http://127.0.0.1:${options.corePort}`,
      CORE_ORG_ID: options.env.ORG_ID,
      PORT: String(options.port),
      WEB_UI_HOST: bindHost(options.host),
      WEB_UI_COOKIE_AUTH: options.cookieAuth ? "1" : "0",
      WEB_UI_PUBLIC_URL: options.env.WEB_UI_PUBLIC_URL ?? url,
      WEB_UI_DEV: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = outputTail(child);
  try {
    await waitForHealth(child, url, output);
  } catch (error) {
    await stopProcess(child);
    throw error;
  }
  let stopPromise: Promise<void> | undefined;
  return {
    stop: () => (stopPromise ??= stopProcess(child)),
  };
}
