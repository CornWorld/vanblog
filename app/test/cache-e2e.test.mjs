// End-to-end regression test for Astro 6 experimental.cache + revalidate.ts.
//
// Public-page caching and /api/revalidate now live in the THEMES (admin was
// extracted into its own standalone SSR app in app/, served via the dispatcher).
// This test builds the `base` theme and exercises its cache lifecycle via plain
// HTTP. No pb backend required — base/index and base/archive tolerate fetch
// failures and still render, which is enough to verify the cache layer.
//
// Run: node --test app/test/cache-e2e.test.mjs
// (the test builds themes/base itself)
//
// What this guards against:
// - Astro 6 cache provider not configured → X-Astro-Cache header missing
// - revalidate.ts silently no-op'ing (cache.invalidate broken / not called)
// - External requests (X-Forwarded-For) bypassing the internal-only guard
// - Empty body or missing fields returning wrong status
// - Control-plane paths (/admin) never being cached

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const THEME_DIR = join(REPO_ROOT, "themes", "base");
const HOST = "127.0.0.1";
const PORT = 4399; // avoid clashing with dev :4321
const BASE = `http://${HOST}:${PORT}`;

// Build the base theme. Admin no longer compiles into themes, so this is the
// standalone public site the cache rules apply to.
function buildTheme() {
  const r = spawnSync(
    "pnpm",
    ["--filter", "@vanblog/theme-base", "build"],
    {
      cwd: REPO_ROOT,
      encoding: "utf8",
      env: { ...process.env, VANBLOG_THEME_NAME: "base" },
    }
  );
  if (r.status !== 0) {
    throw new Error(`theme build failed (exit ${r.status}):\n${r.stdout}\n${r.stderr}`);
  }
}

/**
 * Wait until the server responds 200 on / (or timeout).
 * Astro's node adapter takes ~1-2s to bind in CI.
 */
async function waitForServer(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      if (r.ok || r.status === 500) return; // 500 = pb missing, but server is up
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`server at ${url} did not come up within ${timeoutMs}ms`);
}

async function getCacheHeader(path) {
  const r = await fetch(BASE + path);
  assert.equal(r.status, 200);
  return r.headers.get("x-astro-cache") || "";
}

async function revalidate(body) {
  return fetch(BASE + "/api/revalidate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("astro cache e2e (base theme)", { timeout: 120000 }, () => {
  let server;

  before(async () => {
    buildTheme();
    server = spawn(
      "node",
      [join(THEME_DIR, "dist", "server", "entry.mjs")],
      {
        cwd: THEME_DIR,
        env: { ...process.env, HOST, PORT, THEME_HOST: HOST, THEME_PORT: String(PORT) },
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    // Surface server logs if the test fails — invaluable for debugging.
    server.stdout.on("data", (d) => process.stdout.write(`[astro] ${d}`));
    server.stderr.on("data", (d) => process.stderr.write(`[astro!] ${d}`));
    await waitForServer(BASE);
  });

  after(async () => {
    if (server) {
      server.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 300));
    }
  });

  it("serves X-Astro-Cache: MISS then HIT on repeated home requests", async () => {
    const first = await getCacheHeader("/");
    // First request after build may be HIT if a previous test populated cache,
    // so we purge first to get a deterministic starting state.
    await revalidate({ tags: ["posts"] });
    const miss = await getCacheHeader("/");
    const hit = await getCacheHeader("/");
    assert.equal(miss, "MISS", `expected MISS after purge, got "${miss}" (first=${first})`);
    assert.equal(hit, "HIT", `expected HIT on second request, got "${hit}"`);
  });

  it("purges by tag — POST /api/revalidate {tags:['posts']} flips HIT→MISS", async () => {
    // Prime cache
    await getCacheHeader("/");
    const hit = await getCacheHeader("/");
    assert.equal(hit, "HIT");

    const r = await revalidate({ tags: ["posts"] });
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.purged, true);
    assert.deepEqual(body.tags, ["posts"]);
    assert.equal(body.enabled, true, "cache must be enabled in preview mode");

    const miss = await getCacheHeader("/");
    assert.equal(miss, "MISS", "cache should be invalidated after tag purge");
  });

  it("purges by path — POST /api/revalidate {path:'/archive'}", async () => {
    await getCacheHeader("/archive");
    const hit = await getCacheHeader("/archive");
    assert.equal(hit, "HIT");

    const r = await revalidate({ path: "/archive" });
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.purged, true);
    assert.equal(body.path, "/archive");

    const miss = await getCacheHeader("/archive");
    assert.equal(miss, "MISS");
  });

  it("blocks requests with X-Forwarded-For (external proxy path)", async () => {
    const r = await fetch(BASE + "/api/revalidate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "203.0.113.1",
      },
      body: JSON.stringify({ tags: ["posts"] }),
    });
    assert.equal(r.status, 403);
  });

  it("returns 400 on empty body", async () => {
    const r = await revalidate({});
    assert.equal(r.status, 400);
  });

  it("control-plane paths are not cached — /admin has no X-Astro-Cache", async () => {
    // /admin now lives in the standalone admin SSR app (served by the
    // dispatcher), so the theme responds via its middleware only. We only
    // assert it never reports a cache HIT (would leak personalized content).
    const r = await fetch(BASE + "/admin", { redirect: "manual" });
    const cacheHeader = r.headers.get("x-astro-cache");
    assert.equal(
      cacheHeader,
      null,
      `admin path must not be cached, got X-Astro-Cache: ${cacheHeader}`
    );
  });
});
