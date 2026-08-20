#!/usr/bin/env node
/**
 * artifacts-server.mjs — minimal zero-dependency web UI for experiment artifacts.
 *
 * Usage: node scripts/artifacts-server.mjs [--port 9750] [--root .snow/artifacts]
 *
 * API:
 *   GET /api/runs                      → list of runs with summary
 *   GET /api/runs/:id                  → full run detail (run.json, score, metrics, closed note)
 *   GET /api/runs/:id/file?path=<rel>  → raw file content (transcript, log, session jsonl)
 *
 * Frontend is served by the lab Vite dev server (see vite.config.ts proxy),
 * which routes /api to this server. Read-only: never writes or deletes artifacts.
 */
import { createServer } from "node:http";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve, basename, dirname } from "node:path";

// ── args ──
function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const PORT = parseInt(arg("--port", "9751"), 10);

// Resolve the vanblog project root (dir containing pnpm-workspace.yaml),
// so .snow/artifacts is found regardless of the cwd this server is started from.
function findProjectRoot(start) {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
}
const PROJECT_ROOT = findProjectRoot(process.cwd());
const ROOT = resolve(PROJECT_ROOT, arg("--root", ".snow/artifacts"));

const json = (res, code, data) => {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
};

// ── artifact readers ──
function safeReadJson(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

function runSummary(id, dir) {
  const run = safeReadJson(join(dir, "run.json")) || {};
  const score = safeReadJson(join(dir, "score.json")) || {};
  const metrics = safeReadJson(join(dir, "session-metrics.json"));
  let size = 0;
  try { size = statSync(dir).size; } catch {}
  return {
    id,
    state: existsSync(join(dir, ".closed")) ? "closed" : "open",
    closedNote: existsSync(join(dir, ".closed")) ? readFileSync(join(dir, ".closed"), "utf8").trim() : null,
    mtime: statSync(dir).mtime.toISOString(),
    model: run.agentModel,
    exitReason: run.piExitReason,
    timedOut: run.piTimedOut,
    isolationPassed: run.isolation?.probePassed,
    evalStatus: score.status,
    evalScore: score.tally ? `${score.tally.passed}/${score.tally.total}` : null,
    requests: metrics?.agent?.modelRequestCount,
    toolCalls: metrics?.agent?.toolCallCount,
    tokens: metrics?.tokens?.totalTokens,
    wallSeconds: metrics?.timeline?.wallSeconds,
  };
}

function listRuns() {
  if (!existsSync(ROOT)) return [];
  return readdirSync(ROOT)
    .filter((d) => { try { return statSync(join(ROOT, d)).isDirectory(); } catch { return false; } })
    .map((d) => { try { return runSummary(d, join(ROOT, d)); } catch { return null; } })
    .filter(Boolean)
    .sort((a, b) => b.mtime.localeCompare(a.mtime));
}

const MAX_RAW = 512 * 1024;

// ── API + static page ──
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const parts = url.pathname.split("/").filter(Boolean);

  if (url.pathname === "/api/runs") return json(res, 200, listRuns());

  // /api/runs/:id[/file?path=...]
  if (parts[0] === "api" && parts[1] === "runs" && parts[2]) {
    const id = basename(parts[2]);
    const dir = join(ROOT, id);
    if (!existsSync(dir)) return json(res, 404, { error: "run not found" });

    if (parts[3] === "file") {
      const rel = basename(url.searchParams.get("path") || "");
      const p = join(dir, rel);
      if (!p.startsWith(ROOT) || !existsSync(p) || statSync(p).size > MAX_RAW)
        return json(res, 400, { error: "invalid or missing file" });
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end(readFileSync(p, "utf8"));
    }

    const detail = runSummary(id, dir);
    detail.run = safeReadJson(join(dir, "run.json"));
    detail.score = safeReadJson(join(dir, "score.json"));
    detail.metrics = safeReadJson(join(dir, "session-metrics.json"));
    try {
      detail.transcript = readFileSync(join(dir, "transcript"), "utf8").slice(0, 20000);
    } catch { detail.transcript = null; }
    return json(res, 200, detail);
  }

  json(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  console.log(`artifacts UI: http://127.0.0.1:${PORT}  (root: ${ROOT})`);
});
