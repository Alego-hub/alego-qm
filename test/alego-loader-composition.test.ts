import test from "node:test";
import assert from "node:assert/strict";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "..");
const alegoSource = resolve(process.env.ALEGO_SOURCE_DIR ?? join(repositoryRoot, "..", "alego"));
const alegoCli = join(alegoSource, "apps", "cli", "lib", "bin.js");

function isolatedEnvironment(home: string): NodeJS.ProcessEnv {
  const keys = ["PATH", "HOME", "TMPDIR", "TMP", "TEMP", "SystemRoot", "COMSPEC", "PATHEXT", "LANG", "LC_ALL"];
  return {
    ...Object.fromEntries(keys.flatMap((key) => (process.env[key] === undefined ? [] : [[key, process.env[key]]]))),
    ALEGO_HOME: home,
  };
}

async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  await new Promise<void>((resolveClose, reject) => server.close((error) => (error ? reject(error) : resolveClose())));
  return address.port;
}

async function waitForHealth(child: ChildProcess, port: number, output: () => string): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Alego exited before QM became healthy\n${output()}`);
    const response = await fetch(`http://127.0.0.1:${port}/healthz`).catch(() => null);
    if (response?.ok) {
      assert.deepEqual(await response.json(), { ok: true });
      return;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`QM did not become healthy through Alego\n${output()}`);
}

async function verifyWebSurface(port: number): Promise<void> {
  const root = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(root.status, 200);
  assert.match(root.headers.get("content-type") ?? "", /^text\/html/);
  assert.match(await root.text(), /<title>QM · Web<\/title>/);

  const core = await fetch(`http://127.0.0.1:${port}/v1/surface-config`);
  assert.equal(core.status, 200);
  assert.match(core.headers.get("content-type") ?? "", /^application\/json/);

  const font = await fetch(`http://127.0.0.1:${port}/assets/fonts/KaTeX_Main-Regular.woff2`);
  assert.equal(font.status, 200);
  assert.equal(font.headers.get("content-type"), "font/woff2");
}

async function stopProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  child.kill("SIGINT");
  let timeout: NodeJS.Timeout | undefined;
  await Promise.race([
    exited,
    new Promise((resolveWait) => {
      timeout = setTimeout(resolveWait, 5_000);
    }),
  ]);
  if (timeout) clearTimeout(timeout);
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGKILL");
  await exited;
}

async function verifyAgentTurns(port: number, capturePath: string): Promise<void> {
  const base = `http://127.0.0.1:${port}`;
  const signin = await fetch(`${base}/signin`, {
    method: "POST",
    body: JSON.stringify({ user: "qm-e2e" }),
  });
  assert.equal(signin.status, 200);
  const cookie = signin.headers.get("set-cookie")!.split(";")[0]!;
  const headers = { cookie, "content-type": "application/json" };
  const threadRef = "web:qm-e2e:alego-update";
  const start = async (text: string): Promise<string> => {
    const response = await fetch(`${base}/api/turn`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text, threadRef }),
    });
    const body = (await response.json()) as { runId: string };
    assert.equal(response.status, 202, JSON.stringify(body));
    assert.ok(body.runId);
    return body.runId;
  };
  const waitForRun = async (runId: string, partial = false) => {
    const deadline = Date.now() + 20_000;
    let lastRun: unknown;
    while (Date.now() < deadline) {
      const response = await fetch(`${base}/api/runs/${runId}`, { headers });
      assert.equal(response.status, 200);
      const run = (await response.json()) as {
        status: string;
        partial?: string;
        result?: { status: string; reply: string; sessionId: string; stopped?: boolean };
      };
      lastRun = run;
      if (partial && run.partial) return run;
      if (["done", "failed", "aborted"].includes(run.status)) return run;
      await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    }
    throw new Error(`QM run ${runId} did not settle: ${JSON.stringify(lastRun)}`);
  };
  let sessionId = "";
  for (const input of ["[qm-e2e:remember]", "[qm-e2e:recall]"]) {
    const runId = await start(input);
    const run = await waitForRun(runId);
    assert.equal(run.status, "done", JSON.stringify(run));
    assert.equal(run.result?.status, "ok", JSON.stringify(run));
    assert.match(run.result!.reply, /QM E2E cobalt-731/);
    if (sessionId) assert.equal(run.result!.sessionId, sessionId);
    sessionId = run.result!.sessionId;
    const events = await fetch(`${base}/api/runs/${runId}/events`, { headers });
    assert.match(await events.text(), /event: partial\ndata: .*QM E2E cobalt-731/);
  }
  const sessionResponse = await fetch(`${base}/api/sessions/${sessionId}`, { headers });
  assert.equal(sessionResponse.status, 200);
  const session = (await sessionResponse.json()) as { entries: Array<{ type: string }> };
  assert.equal(session.entries.filter((entry) => entry.type === "assistant").length, 2);
  assert.equal(session.entries.filter((entry) => entry.type === "user").length, 2);
  assert.ok(
    session.entries.some((entry) => entry.type === "tool_result"),
    JSON.stringify(session),
  );
  const abortId = await start("[qm-e2e:abort]");
  assert.match((await waitForRun(abortId, true)).partial ?? "", /Waiting for cancellation/);
  const abort = await fetch(`${base}/api/runs/${abortId}/signal`, {
    method: "POST",
    headers,
    body: JSON.stringify({ kind: "abort" }),
  });
  assert.equal(abort.status, 200);
  const cancelled = await waitForRun(abortId);
  assert.equal(cancelled.result?.stopped, true, JSON.stringify(cancelled));
  const requests = (await readFile(capturePath, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.ok(requests.length >= 5);
  assert.ok(requests.every((request) => request.maxTokens === 128));
}

test(
  "the packed plugin runs tools, replays turns, streams, cancels, and disposes through Alego's CLI",
  { skip: !process.env.ALEGO_SOURCE_DIR && !existsSync(alegoCli), timeout: 120_000 },
  async () => {
    assert.ok(existsSync(alegoCli), "Build the Alego checkout with pnpm run build before testing its packed plugins");
    const root = await mkdtemp(join(tmpdir(), "alego-qm-loader-"));
    const home = join(root, "home");
    const profile = "qm-composition";
    const port = await availablePort();
    const capturePath = join(root, "requests.jsonl");
    const env = isolatedEnvironment(home);
    let child: ChildProcess | undefined;
    let output = "";
    const appendOutput = (chunk: unknown) => {
      output = `${output}${String(chunk)}`.slice(-20_000);
    };
    try {
      const packed = await execFileAsync("npm", ["pack", "./alego-plugin", "--pack-destination", root, "--json"], {
        cwd: repositoryRoot,
        maxBuffer: 10 * 1024 * 1024,
      });
      const [{ filename }] = JSON.parse(packed.stdout) as [{ filename: string }];
      const tarball = join(root, filename);
      await execFileAsync(process.execPath, [alegoCli, "plugin", "--profile", profile, "add", tarball], {
        cwd: alegoSource,
        env,
        maxBuffer: 10 * 1024 * 1024,
      });
      await writeFile(
        join(home, "profiles", profile, "cordis.patch.yml"),
        [
          "- insert:",
          "    - id: qm-fixture-llm",
          `      name: ${JSON.stringify(join(repositoryRoot, "test/fixtures/alego-qm-llm.mjs"))}`,
          "      config:",
          `        capturePath: ${JSON.stringify(capturePath)}`,
          "- id: alego-qm",
          "  config:",
          "    provider: qm-fixture",
          "    model: qm-test-model",
          "    maxTokens: 128",
          `    port: ${port}`,
          `    dataDir: ${join(root, "data")}`,
          "    backgroundWork: true",
          "",
        ].join("\n"),
      );
      child = spawn(process.execPath, [alegoCli, "--profile", profile], {
        cwd: alegoSource,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      child.stdout?.on("data", appendOutput);
      child.stderr?.on("data", appendOutput);
      await waitForHealth(child, port, () => output);
      await verifyWebSurface(port);
      try {
        await verifyAgentTurns(port, capturePath);
      } catch (error) {
        throw new Error(`${String(error)}\n${output}`, { cause: error });
      }
      assert.match(output, /\[qm\] listening on 127\.0\.0\.1:/);
      assert.match(output, /\[web-ui\] surface on http:\/\/127\.0\.0\.1:/);
    } finally {
      if (child) await stopProcess(child);
      if (child) assert.ok(child.exitCode !== null || child.signalCode !== null);
      if (child) assert.notEqual(child.signalCode, "SIGKILL", output);
      await rm(root, { recursive: true, force: true });
    }
  },
);
