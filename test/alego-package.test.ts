import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("the published artifact is an installable Alego bundle", async () => {
  await execFileAsync(process.execPath, ["scripts/build-alego-plugin.mjs", "--check"], {
    cwd: new URL("..", import.meta.url),
  });
  const rootManifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as {
    private: boolean;
    dependencies: Record<string, string>;
  };
  const manifest = JSON.parse(await readFile(new URL("../alego-plugin/package.json", import.meta.url), "utf8")) as {
    main: string;
    files: string[];
    dependencies: Record<string, string>;
    alego: { bundle: { patch: string } };
  };
  assert.equal(rootManifest.private, true);
  assert.ok(rootManifest.dependencies.fastify);
  assert.ok(rootManifest.dependencies["@earendil-works/pi-coding-agent"]);
  assert.equal(manifest.main, "dist/src/alego-plugin.js");
  assert.equal(manifest.alego.bundle.patch, "./cordis.patch.yml");
  assert.equal(
    await readFile(new URL("../LICENSE", import.meta.url), "utf8"),
    await readFile(new URL("../alego-plugin/LICENSE", import.meta.url), "utf8"),
  );
  assert.ok(manifest.files.includes("LICENSE"));
  assert.ok(manifest.files.includes("dist/"));
  assert.deepEqual(Object.keys(manifest.dependencies), ["@anthropic-ai/tokenizer"]);
  const plugin = (await import(new URL(`../alego-plugin/${manifest.main}`, import.meta.url).href)) as Record<
    string,
    unknown
  >;
  assert.equal(plugin.name, "alego-qm");
  assert.deepEqual(plugin.inject, ["attachments", "llm"]);
  assert.equal(typeof plugin.apply, "function");
  assert.equal("default" in plugin, false);
});
