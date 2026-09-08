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
import {
  readdirSync,
  readFileSync,
  existsSync,
  statSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { join, resolve, basename, dirname } from "node:path";
import { spawn } from "node:child_process";

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
  return {
    id,
    state: existsSync(join(dir, ".closed")) ? "closed" : "open",
    closedNote: existsSync(join(dir, ".closed")) ? readFileSync(join(dir, ".closed"), "utf8").trim() : null,
    mtime: statSync(dir).mtime.toISOString(),
    model: run.agentModel,
    exitReason: run.piExitReason,
    evalStatus: score.status,
    evalScore: score.score ? `${score.score.passed}/${score.score.total}` : null,
    requests: metrics?.agent?.modelRequestCount,
    toolCalls: metrics?.agent?.toolCallCount,
    tokens: metrics?.tokens?.totalTokens,
    wallSeconds: metrics?.timeline?.wallSeconds,
    langfuse: run.langfuse ?? null,
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

// ── jobs: 触发 scripts/pentest/nuclei-run.mjs(黑盒不变量验证)──
// 安全约束:仅此一个白名单脚本;target 仅限本地回环;admin 凭据经服务端
// env 透传给子进程,永不经过 HTTP API。
const JOBS_FILE = () => resolve(PROJECT_ROOT, "refs/pentest/jobs.json");
const LAST_RUN = () => resolve(PROJECT_ROOT, "refs/pentest/last-run.json");
const LOCAL_TARGET = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/;

function readJobs() {
  try {
    return JSON.parse(readFileSync(JOBS_FILE(), "utf8"));
  } catch {
    return [];
  }
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    return {};
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const parts = url.pathname.split("/").filter(Boolean);

  // ── jobs API(本地安全扫描触发) ──
  if (url.pathname === "/api/jobs") {
    // nuclei-run 结束时写 last-run.json;据此把仍在 "running" 的条目标为 done。
    const last = safeReadJson(LAST_RUN());
    const jobs = readJobs().map((j) =>
      j.status === "running" && last?.at && last.at > j.at
        ? { ...j, status: "done", findings: last.findings?.length ?? 0 }
        : j
    );
    return json(res, 200, jobs);
  }

  if (url.pathname === "/api/jobs/last") {
    return json(res, 200, safeReadJson(LAST_RUN()));
  }

  if (url.pathname === "/api/jobs/run" && req.method === "POST") {
    const body = await readBody(req);
    const target = String(body.target || "http://127.0.0.1:8090");
    if (!LOCAL_TARGET.test(target))
      return json(res, 400, { error: "target 仅允许本地回环地址" });
    const job = {
      id: new Date().toISOString().replace(/[:.]/g, "-"),
      at: new Date().toISOString(),
      target,
      seed: !!body.seed,
      cleanup: !!body.cleanup,
      status: "running",
    };
    const args = [
      resolve(PROJECT_ROOT, "scripts/pentest/nuclei-run.mjs"),
      "--target",
      target,
      ...(job.seed ? ["--seed"] : []),
      ...(job.cleanup ? ["--cleanup"] : []),
    ];
    const child = spawn(process.execPath, args, {
      cwd: PROJECT_ROOT,
      detached: true,
      stdio: "ignore",
      env: process.env,
    });
    job.pid = child.pid;
    child.unref();
    const jobs = readJobs();
    jobs.unshift(job);
    mkdirSync(resolve(PROJECT_ROOT, "refs/pentest"), { recursive: true });
    writeFileSync(JOBS_FILE(), JSON.stringify(jobs.slice(0, 50), null, 2));
    return json(res, 200, job);
  }

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

    // /api/runs/:id/session — raw session events (no pre-computed metrics needed)
    if (parts[3] === "session") {
      const sessionDir = join(dir, "pi-session");
      if (!existsSync(sessionDir))
        return json(res, 404, { error: "no session data" });
      const events = [];
      for (const f of readdirSync(sessionDir).filter((f) => f.endsWith(".jsonl")).sort()) {
        for (const line of readFileSync(join(sessionDir, f), "utf8").split("\n")) {
          const t = line.trim();
          if (!t) continue;
          try { events.push(JSON.parse(t)); } catch { /* skip truncated final line */ }
        }
      }
      return json(res, 200, events);
    }

    const detail = runSummary(id, dir);
    detail.run = safeReadJson(join(dir, "run.json"));
    detail.score = safeReadJson(join(dir, "score.json"));
    try {
      const transcript = readFileSync(join(dir, "transcript"), "utf8");
      detail.transcript = transcript.slice(0, 20000);
      detail.transcriptTruncated = transcript.length > 20000;
    } catch { detail.transcript = null; }
    return json(res, 200, detail);
  }

  json(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  console.log(`artifacts UI: http://127.0.0.1:${PORT}  (root: ${ROOT})`);
});
