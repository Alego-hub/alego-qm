import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

test("the published artifact is an installable Alego bundle", async () => {
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
  assert.match(
    await readFile(new URL("../alego-plugin/dist/web-ui/dist-web/index.html", import.meta.url), "utf8"),
    /<title>QM · Web<\/title>/,
  );
  assert.ok(
    (await readdir(new URL("../alego-plugin/dist/web-ui/dist-web/assets/", import.meta.url))).some((file) =>
      file.endsWith(".js"),
    ),
  );
  assert.ok(
    (await readdir(new URL("../alego-plugin/dist/web-ui/dist-web/assets/fonts/", import.meta.url))).includes(
      "KaTeX_Main-Regular.woff2",
    ),
  );
  assert.match(
    await readFile(new URL("../alego-plugin/dist/web-ui/server/index.js", import.meta.url), "utf8"),
    /\[web-ui\] surface on/,
  );
  const plugin = (await import(new URL(`../alego-plugin/${manifest.main}`, import.meta.url).href)) as Record<
    string,
    unknown
  >;
  assert.equal(plugin.name, "alego-qm");
  assert.deepEqual(plugin.inject, ["attachments", "llm"]);
  assert.equal(typeof plugin.apply, "function");
  assert.equal("default" in plugin, false);
});
