#!/usr/bin/env node
/**
 * extract-session-metrics.mjs — derive quantitative metrics from a pi session JSONL.
 *
 * Usage:
 *   node scripts/extract-session-metrics.mjs --session-dir <dir> [--out <file>]
 *
 * Reads every *.jsonl file in the session dir and writes a metrics JSON with:
 *   - event type counts
 *   - assistant model request count (with usage per request)
 *   - tool call counts by tool name
 *   - tool result error counts
 *   - token totals (input/output/cacheRead/reasoning) and cost
 *   - timeline (first event, first tool call, last event, wall duration)
 *   - failure evidence (last stopReason, last error tool results, truncated transcripts)
 *
 * Deterministic: no network, no model calls, only parses archived evidence.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const sessionDir = arg("--session-dir");
const outPath = arg("--out");
if (!sessionDir || !existsSync(sessionDir)) {
  console.error("usage: extract-session-metrics.mjs --session-dir <dir> [--out <file>]");
  process.exit(2);
}

const files = readdirSync(sessionDir).filter((f) => f.endsWith(".jsonl")).sort();
const events = [];
for (const f of files) {
  for (const line of readFileSync(join(sessionDir, f), "utf8").split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      events.push(JSON.parse(t));
    } catch {
      // keep going; a truncated final line is itself evidence
      events.push({ type: "parse_error", raw: t.slice(0, 200) });
    }
  }
}

const counts = {};
for (const e of events) counts[e.type] = (counts[e.type] || 0) + 1;

let modelRequests = 0;
let toolCalls = 0;
const toolCallCounts = {};
let toolResultErrors = 0;
let toolResults = 0;
const usageTotals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, totalTokens: 0 };
let costTotal = 0;
const requestTimeline = [];
const stopReasons = [];
const lastErrors = [];
let firstTs = null;
let lastTs = null;
let firstToolCallTs = null;
let sessionIds = [];
let modelIds = new Set();

function ts(e) {
  const raw = e.timestamp || e.message?.timestamp;
  return raw ? new Date(raw).getTime() : null;
}

for (const e of events) {
  const t = ts(e);
  if (t) {
    if (firstTs === null || t < firstTs) firstTs = t;
    if (lastTs === null || t > lastTs) lastTs = t;
  }
  switch (e.type) {
    case "session":
      sessionIds.push(e.id);
      break;
    case "model_change":
      if (e.modelId) modelIds.add(`${e.provider}/${e.modelId}`);
      break;
    case "message": {
      const m = e.message || {};
      if (m.role === "assistant") {
        modelRequests++;
        const u = m.usage || {};
        for (const k of Object.keys(usageTotals)) usageTotals[k] += u[k] || 0;
        const c = u.cost?.total ?? 0;
        costTotal += typeof c === "number" ? c : 0;
        stopReasons.push(m.stopReason ?? null);
        requestTimeline.push({
          ts: m.timestamp,
          model: m.model,
          provider: m.provider,
          stopReason: m.stopReason ?? null,
          input: u.input ?? 0,
          output: u.output ?? 0,
          cacheRead: u.cacheRead ?? 0,
        });
        for (const part of m.content || []) {
          if (part?.type === "toolCall") {
            toolCalls++;
            const name = part.name || "unknown";
            toolCallCounts[name] = (toolCallCounts[name] || 0) + 1;
            if (firstToolCallTs === null) firstToolCallTs = t;
          }
        }
      } else if (m.role === "toolResult") {
        toolResults++;
        if (m.isError) {
          toolResultErrors++;
          if (lastErrors.length < 10) {
            const text = Array.isArray(m.content)
              ? m.content.filter((c) => c.type === "text").map((c) => c.text).join(" ").slice(0, 300)
              : "";
            lastErrors.push({ toolName: m.toolName, ts: m.timestamp, text });
          }
        }
      }
      break;
    }
    default:
      break;
  }
}

const wallMs = firstTs !== null && lastTs !== null ? lastTs - firstTs : null;
const metrics = {
  generatedAt: new Date().toISOString(),
  source: { sessionDir, files },
  sessionIds,
  models: [...modelIds],
  eventCounts: counts,
  agent: {
    modelRequestCount: modelRequests,
    toolCallCount: toolCalls,
    toolCallCounts,
    toolResultCount: toolResults,
    toolResultErrorCount: toolResultErrors,
    parseErrorCount: counts.parse_error || 0,
  },
  tokens: { ...usageTotals, costTotal },
  timeline: {
    firstEvent: firstTs !== null ? new Date(firstTs).toISOString() : null,
    firstToolCall: firstToolCallTs !== null ? new Date(firstToolCallTs).toISOString() : null,
    lastEvent: lastTs !== null ? new Date(lastTs).toISOString() : null,
    wallSeconds: wallMs !== null ? Math.round(wallMs / 100) / 10 : null,
  },
  requestTimeline,
  stopReasons,
  lastToolErrors: lastErrors,
  observabilityNotes: {
    retriedRequests: "not directly recorded by pi session; SDK-internal retries are not observable here",
    concurrentRequests: "session JSONL is append-ordered; concurrency requires proxy-side request ids",
  },
};

const json = JSON.stringify(metrics, null, 2);
if (outPath) {
  writeFileSync(outPath, json);
  console.log(`metrics written: ${outPath}`);
} else {
  console.log(json);
}
