import test from "node:test";
import assert from "node:assert/strict";
import { proxyHeaders } from "../../chassis/src/http-proxy.ts";

test("proxy headers remove fixed and connection-named hop-by-hop fields", () => {
  assert.deepEqual(
    proxyHeaders(
      {
        Connection: "x-private, X-Trace-Hop",
        "x-private": "private",
        "X-Trace-Hop": "trace",
        "proxy-connection": "keep-alive",
        trailers: "x-checksum",
        "set-cookie": ["private=1"],
        "x-kept": "public",
      },
      ["set-cookie"],
    ),
    { "x-kept": "public" },
  );
});
