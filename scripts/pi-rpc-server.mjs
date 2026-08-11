#!/usr/bin/env node
/**
 * pi-rpc-server.mjs — HTTP → pi RPC bridge
 *
 * Spawns `pi --mode rpc` and exposes it as a streaming HTTP endpoint.
 * Clients POST a prompt and receive pi's response as SSE events.
 *
 * Started by docker/entrypoint.dev.sh. Listens on VANBLOG_PI_PORT (default 4329).
 */

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { request as httpsRequest } from "node:https";

const PORT = parseInt(process.env.VANBLOG_PI_PORT || "4329", 10);

// ── Zen auth-stripping proxy ─────────────────────────────────────
// WHY THIS IS NEEDED (verified 2026-08):
//   * OpenCode Zen free models (deepseek-v4-flash-free, mimo-v2.5-free, ...)
//     MUST NOT send an Authorization header — any key returns 401.
//   * pi's openai-completions provider ALWAYS injects `Authorization: Bearer <apiKey>`
//     when a custom provider has an apiKey field. There is no built-in switch to
//     disable it (`authHeader: false` is a dead schema field; verified 401).
//   * pi requires apiKey non-empty to expose the model at all.
//   => The only way to satisfy pi (needs a key) + Zen (rejects a key) is to
//      strip the header in-between. That is this 12-line reverse proxy.
//   If a future pi version drops the apiKey requirement, this proxy can be removed.
const ZEN_TARGET = "https://opencode.ai";
const PROXY_PORT = PORT + 1;
createServer((clientReq, clientRes) => {
  const opts = { method: clientReq.method, headers: { ...clientReq.headers } };
  delete opts.headers["authorization"]; // ← THE FIX: strip auth for Zen free
  delete opts.headers.host;
  const proxy = httpsRequest(ZEN_TARGET + clientReq.url, opts, (proxyRes) => {
    clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(clientRes);
  });
  clientReq.pipe(proxy);
}).listen(PROXY_PORT, "127.0.0.1", () => console.log(`[pi-rpc] Zen proxy: 127.0.0.1:${PROXY_PORT} → ${ZEN_TARGET}`));

// ── Spawn pi in RPC mode ────────────────────────────────────────
const pi = spawn("pi", ["--mode", "rpc", "--approve", "--no-session"], {
  stdio: ["pipe", "pipe", "inherit"],
  cwd: "/workspace",
});

let piReady = false;
let lineBuffer = "";

pi.stdout.on("data", (chunk) => {
  lineBuffer += chunk.toString();
  const lines = lineBuffer.split("\n");
  lineBuffer = lines.pop(); // keep incomplete line
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const evt = JSON.parse(line);
      if (evt.type === "response" && evt.command === "prompt") {
        piReady = evt.success;
      }
    } catch {
      // Non-JSON line (partial chunk or noise) — skip.
    }
  }
});

// Send a prompt to pi via stdin JSONL
function sendPrompt(message) {
  return new Promise((resolve, _reject) => {
    const req = JSON.stringify({ type: "prompt", message }) + "\n";
    pi.stdin.write(req);
    // Wait briefly for acceptance response, then start streaming
    const timeout = setTimeout(() => resolve(), 5000);
    const check = () => {
      if (piReady) { clearTimeout(timeout); resolve(); }
      else setTimeout(check, 50);
    };
    check();
  });
}

// ── HTTP server ───────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", piReady }));
    return;
  }

  if (req.method === "POST" && req.url === "/pi/rpc") {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", async () => {
      let message;
      try { message = JSON.parse(body).message; } catch {
        res.writeHead(400);
        res.end("invalid json");
        return;
      }
      if (!message) {
        res.writeHead(400);
        res.end("missing message");
        return;
      }

      // SSE headers
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      // Set up event forwarding BEFORE sending the prompt
      const onData = (chunk) => {
        lineBuffer += chunk.toString();
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line);
            res.write(`data: ${JSON.stringify(evt)}\n\n`);
            if (evt.type === "agent_settled") {
              pi.stdout.removeListener("data", onData);
              res.end();
            }
          } catch {
            // Skip non-JSON SSE chunks (partial buffer split or noise).
          }
        }
      };

      pi.stdout.on("data", onData);

      // Send the prompt
      try {
        await sendPrompt(message);
      } catch (err) {
        pi.stdout.removeListener("data", onData);
        res.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
        res.end();
      }
    });
    return;
  }

  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[pi-rpc] listening on http://127.0.0.1:${PORT}`);
  console.log(`[pi-rpc] pi RPC process started (pid=${pi.pid})`);
});

// ── Cleanup ──────────────────────────────────────────────────────
process.on("SIGTERM", () => { pi.kill(); process.exit(0); });
process.on("SIGINT", () => { pi.kill(); process.exit(0); });
