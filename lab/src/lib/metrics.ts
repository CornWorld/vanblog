import type { SessionEvent, RunDetail } from "../api";
import { fmtSec, fmtNum } from "./format";

// ── session metrics (computed client-side from raw session events) ──
// NOTE on timestamps: an assistant message's timestamp is when the model request
// was SENT (right after the previous tool result); a toolResult's timestamp is when
// the tool finished. So gap(assistant → toolResult) = model generation + tool
// execution combined — the session does NOT record when the model response arrived,
// so "thinking" vs "tool" cannot be separated from timestamps alone.
// We therefore break time down by ROUND (each assistant message → its completion).

export interface SessionRound {
  model: string;
  stopReason: string;
  input: number;
  output: number;
  elapsedMs: number;
  tools: string[];
}

export interface SessionMetrics {
  timeline: { wallSeconds: number };
  agent: {
    modelRequestCount: number;
    toolCallCount: number;
    toolResultErrorCount: number;
    toolCallCounts: Record<string, number>;
  };
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    reasoning: number;
    totalTokens: number;
  };
  rounds: SessionRound[];
}

export function computeSessionMetrics(events: SessionEvent[]): SessionMetrics {
  let firstTs = Infinity,
    lastTs = -Infinity;
  let modelRequests = 0,
    toolCalls = 0,
    toolResultErrors = 0;
  const toolCallCounts: Record<string, number> = {};
  const tokens = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    reasoning: 0,
  };
  const rounds: SessionRound[] = [];
  const assistantMsg: {
    ts: number;
    model: string;
    stopReason: string;
    input: number;
    output: number;
    tools: string[];
  }[] = [];
  let lastEventTs = -Infinity;

  for (const e of events) {
    if (e.type !== "message") continue;
    const m = e.message;
    const ts = m.timestamp;
    if (ts < firstTs) firstTs = ts;
    if (ts > lastTs) lastTs = ts;
    if (ts > lastEventTs) lastEventTs = ts;

    if (m.role === "assistant") {
      modelRequests++;
      tokens.input += m.usage?.input ?? 0;
      tokens.output += m.usage?.output ?? 0;
      tokens.cacheRead += m.usage?.cacheRead ?? 0;
      tokens.cacheWrite += m.usage?.cacheWrite ?? 0;
      tokens.reasoning += m.usage?.reasoning ?? 0;
      const tools: string[] = [];
      for (const part of m.content ?? []) {
        if (part.type === "toolCall") {
          toolCalls++;
          toolCallCounts[part.name] = (toolCallCounts[part.name] ?? 0) + 1;
          tools.push(part.name);
        }
      }
      assistantMsg.push({
        ts,
        model: m.model,
        stopReason: m.stopReason,
        input: m.usage?.input ?? 0,
        output: m.usage?.output ?? 0,
        tools,
      });
    } else if (m.role === "toolResult") {
      if (m.isError) toolResultErrors++;
    }
  }

  for (let i = 0; i < assistantMsg.length; i++) {
    const a = assistantMsg[i];
    const end =
      i + 1 < assistantMsg.length ? assistantMsg[i + 1].ts : lastEventTs;
    rounds.push({
      model: a.model,
      stopReason: a.stopReason,
      input: a.input,
      output: a.output,
      elapsedMs: Math.max(0, end - a.ts),
      tools: a.tools,
    });
  }

  const totalTokens =
    tokens.input +
    tokens.output +
    tokens.cacheRead +
    tokens.cacheWrite +
    tokens.reasoning;
  const wallMs = firstTs !== Infinity ? lastTs - firstTs : 0;

  return {
    timeline: { wallSeconds: Math.round(wallMs / 100) / 10 },
    agent: {
      modelRequestCount: modelRequests,
      toolCallCount: toolCalls,
      toolResultErrorCount: toolResultErrors,
      toolCallCounts,
    },
    tokens: { ...tokens, totalTokens },
    rounds,
  };
}

export interface Insight {
  level: "ok" | "warn" | "err";
  text: string;
}

// ── insight: auto-generated findings from a run ──
export function generateInsights(
  sm: SessionMetrics | null,
  score: RunDetail["score"],
  run: Record<string, any>
): Insight[] {
  const ins: Insight[] = [];
  if (!sm) {
    ins.push({ level: "warn", text: "无 session 数据，无法分析执行过程" });
    return ins;
  }
  const wall = sm.timeline.wallSeconds;
  if (wall > 600)
    ins.push({
      level: "warn",
      text: `总耗时 ${fmtSec(wall)}，超过 10 分钟，可能接近超时`,
    });
  const tok = sm.tokens.totalTokens;
  if (tok > 500000)
    ins.push({ level: "warn", text: `token 消耗 ${fmtNum(tok)}，偏高` });
  const errs = sm.agent.toolResultErrorCount;
  if (errs > 0)
    ins.push({
      level: "warn",
      text: `${errs} 次工具执行报错，agent 可能走了弯路`,
    });
  const sorted = [...sm.rounds].sort((a, b) => b.elapsedMs - a.elapsedMs);
  const top = sorted[0];
  if (top && top.elapsedMs > 60000) {
    const pct = (top.elapsedMs / (wall * 1000)) * 100;
    ins.push({
      level: "ok",
      text: `单轮耗时 ${fmtSec(top.elapsedMs / 1000)} (占 ${pct.toFixed(
        0
      )}%)：输出 ${fmtNum(top.output)} tokens，是主要瓶颈`,
    });
  }
  const tools = Object.entries(sm.agent.toolCallCounts).sort(
    (a, b) => b[1] - a[1]
  );
  if (tools.length) {
    const [topTool, cnt] = tools[0];
    ins.push({ level: "ok", text: `最常用工具 ${topTool} (${cnt} 次)` });
  }
  if (score?.status === "passed")
    ins.push({
      level: "ok",
      text: `评测通过 ${score.score?.passed}/${score.score?.total}`,
    });
  else if (score?.status === "failed")
    ins.push({
      level: "err",
      text: `评测失败：${score.runtime?.failed?.join(", ") || "未知"}`,
    });
  return ins;
}