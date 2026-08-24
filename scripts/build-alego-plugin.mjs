import { cp, mkdir, readdir, readFile, rename, rm } from "node:fs/promises";
import { build } from "esbuild";

const packageRoot = "alego-plugin";
const stagingRoot = `${packageRoot}/.build-${process.pid}`;
const artifactDirectories = ["dist", "plugins", "cli"];

await rm(stagingRoot, { recursive: true, force: true });

async function artifactFiles(root, relative = "") {
  const entries = await readdir(`${root}/${relative}`, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await artifactFiles(root, path)));
    else files.push(path);
  }
  return files.sort();
}

async function verifyArtifact(directory) {
  const generatedRoot = `${stagingRoot}/${directory}`;
  const checkedInRoot = `${packageRoot}/${directory}`;
  const generatedFiles = await artifactFiles(generatedRoot);
  const checkedInFiles = await artifactFiles(checkedInRoot);
  if (generatedFiles.join("\n") !== checkedInFiles.join("\n"))
    throw new Error(`${directory} artifact file list is stale; run npm run build:alego-plugin`);
  for (const path of generatedFiles) {
    const [generated, checkedIn] = await Promise.all([
      readFile(`${generatedRoot}/${path}`),
      readFile(`${checkedInRoot}/${path}`),
    ]);
    if (!generated.equals(checkedIn)) throw new Error(`${directory}/${path} is stale; run npm run build:alego-plugin`);
  }
}

try {
  await mkdir(`${stagingRoot}/dist/src`, { recursive: true });
  await build({
    entryPoints: ["src/alego-plugin.ts"],
    outfile: `${stagingRoot}/dist/src/alego-plugin.js`,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node24",
    banner: {
      js: 'import { createRequire as createAlegoQmRequire } from "node:module"; const require = createAlegoQmRequire(import.meta.url);',
    },
    external: [
      "@anthropic-ai/tokenizer",
      "@singula-ai/alego-agent",
      "@singula-ai/alego-agent-loop",
      "@singula-ai/alego-attachment",
      "@singula-ai/alego-llm",
      "@singula-ai/alego-session",
      "@singula-ai/alego-system-prompt",
      "@singula-ai/alego-tools",
      "@singula-ai/cordis",
    ],
    legalComments: "eof",
  });
  await cp("src/resolution/protocols", `${stagingRoot}/dist/src/protocols`, { recursive: true });
  await cp("plugins/onboarding/skills", `${stagingRoot}/plugins/onboarding/skills`, { recursive: true });
  await cp("cli/templates/slack-manifest.json", `${stagingRoot}/cli/templates/slack-manifest.json`);
  if (process.argv.includes("--check")) {
    for (const directory of artifactDirectories) await verifyArtifact(directory);
  } else {
    for (const directory of artifactDirectories) {
      await rm(`${packageRoot}/${directory}`, { recursive: true, force: true });
      await rename(`${stagingRoot}/${directory}`, `${packageRoot}/${directory}`);
    }
  }
} finally {
  await rm(stagingRoot, { recursive: true, force: true });
}
