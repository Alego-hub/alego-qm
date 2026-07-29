import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, flyBin, isInvalidSecret, readEnvFile } from "../src/util.ts";

test("managed credential encryption keys require strong material", () => {
  assert.equal(isInvalidSecret("CONNECTOR_SECRET_KEY", "short"), true);
  assert.equal(isInvalidSecret("CONNECTOR_SECRET_KEY", "x".repeat(32)), false);
});

test("flyBin honors $FLY_BIN verbatim", () => {
  const saved = process.env.FLY_BIN;
  try {
    process.env.FLY_BIN = "/opt/fly/bin/flyctl";
    assert.equal(flyBin(), "/opt/fly/bin/flyctl");
  } finally {
    if (saved === undefined) delete process.env.FLY_BIN;
    else process.env.FLY_BIN = saved;
  }
});

test("flyBin falls back to an auto-detected binary name when $FLY_BIN is unset", () => {
  const saved = process.env.FLY_BIN;
  try {
    delete process.env.FLY_BIN;
    assert.ok(["flyctl", "fly"].includes(flyBin()));
  } finally {
    if (saved !== undefined) process.env.FLY_BIN = saved;
  }
});

test("canonicalJson sorts keys and matches JSON.stringify's undefined semantics", () => {
  assert.equal(canonicalJson({ b: 1, a: { d: 2, c: 3 } }), '{"a":{"c":3,"d":2},"b":1}');
  assert.equal(canonicalJson({ a: undefined, b: 1 }), JSON.stringify({ a: undefined, b: 1 }));
  assert.equal(canonicalJson([1, undefined, "x"]), JSON.stringify([1, undefined, "x"]));
  assert.equal(canonicalJson({ a: [undefined], b: null }), '{"a":[null],"b":null}');
  for (const value of [null, 0, "s", true, [], {}]) {
    assert.equal(canonicalJson(value), JSON.stringify(value));
  }
});

test("readEnvFile preserves hashes in unquoted values", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "qm-env-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, ".env");
  writeFileSync(file, "# ignored\nTOKEN=abc#def\nURL=https://host/path#fragment\n");
  assert.deepEqual(
    [...readEnvFile(file)],
    [
      ["TOKEN", "abc#def"],
      ["URL", "https://host/path#fragment"],
    ],
  );
});

async function withFakeStdin<T>(fn: (emit: (bytes: Buffer) => void) => Promise<T>): Promise<T> {
  const { EventEmitter } = await import("node:events");
  const fake = Object.assign(new EventEmitter(), {
    isTTY: true,
    setRawMode(): void {},
    resume(): void {},
    pause(): void {},
  });
  const descriptor = Object.getOwnPropertyDescriptor(process, "stdin")!;
  Object.defineProperty(process, "stdin", { value: fake, configurable: true });
  const write = process.stdout.write.bind(process.stdout);
  process.stdout.write = (() => true) as typeof process.stdout.write;
  try {
    return await fn((bytes) => void fake.emit("data", bytes));
  } finally {
    process.stdout.write = write;
    Object.defineProperty(process, "stdin", descriptor);
  }
}

test("promptHidden decodes multi-byte UTF-8 (split across chunks) and backspaces whole characters", async () => {
  const { promptHidden } = await import("../src/util.ts");
  await withFakeStdin(async (emit) => {
    const pending = promptHidden("SECRET");
    const bytes = Buffer.from("pä中x", "utf8");
    emit(bytes.subarray(0, 4));
    emit(bytes.subarray(4));
    emit(Buffer.from([0x7f]));
    emit(Buffer.from([0x7f]));
    emit(Buffer.from("é!\r", "utf8"));
    assert.equal(await pending, "päé!");
  });
});

test("promptHidden treats Ctrl-D as enter on a non-empty buffer and as cancel on an empty one", async () => {
  const { promptHidden } = await import("../src/util.ts");
  await withFakeStdin(async (emit) => {
    const pending = promptHidden("SECRET");
    emit(Buffer.from("hunter2", "utf8"));
    emit(Buffer.from([0x04]));
    assert.equal(await pending, "hunter2");
  });
  await withFakeStdin(async (emit) => {
    const pending = promptHidden("SECRET");
    emit(Buffer.from([0x04]));
    await assert.rejects(() => pending, /secret entry cancelled/);
  });
});
