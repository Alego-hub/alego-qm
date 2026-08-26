import test from "node:test";
import assert from "node:assert/strict";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "..");
const alegoSource = resolve(process.env.ALEGO_SOURCE_DIR ?? join(repositoryRoot, "..", "alego"));
const alegoCli = join(alegoSource, "apps", "cli", "src", "bin.ts");

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

test(
  "the packed plugin boots and disposes through Alego's CLI, Loader, profile, and process",
  { skip: !existsSync(alegoCli), timeout: 60_000 },
  async () => {
    const root = await mkdtemp(join(tmpdir(), "alego-qm-loader-"));
    const home = join(root, "home");
    const profile = "qm-composition";
    const tarball = join(root, "alego-qm-0.1.0.tgz");
    const port = await availablePort();
    const env = isolatedEnvironment(home);
    let child: ChildProcess | undefined;
    let output = "";
    const appendOutput = (chunk: unknown) => {
      output = `${output}${String(chunk)}`.slice(-20_000);
    };
    try {
      await execFileAsync("npm", ["pack", "./alego-plugin", "--pack-destination", root], {
        cwd: repositoryRoot,
        maxBuffer: 10 * 1024 * 1024,
      });
      await execFileAsync("pnpm", ["alego", "plugin", "--profile", profile, "add", tarball], {
        cwd: alegoSource,
        env,
        maxBuffer: 10 * 1024 * 1024,
      });
      await writeFile(
        join(home, "profiles", profile, "cordis.patch.yml"),
        [
          "- id: alego-qm",
          "  config:",
          `    port: ${port}`,
          `    dataDir: ${join(root, "data")}`,
          "    backgroundWork: false",
          "",
        ].join("\n"),
      );
      child = spawn(process.execPath, ["--import", "tsx/esm", alegoCli, "--profile", profile], {
        cwd: alegoSource,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      child.stdout?.on("data", appendOutput);
      child.stderr?.on("data", appendOutput);
      await waitForHealth(child, port, () => output);
      await verifyWebSurface(port);
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
