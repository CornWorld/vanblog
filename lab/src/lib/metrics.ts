import type { Entry, RunDetail } from "../api";
import { fmtSec, fmtNum } from "./format";
import type { AgentMessage } from "@earendil-works/pi-agent-core";

export const METRIC_DEFINITIONS = {
  wall: "首条→末条消息时间戳跨度，非实际运行时长",
  tokens: "input+output+cacheRead+cacheWrite+reasoning 总和",
  requests: "模型请求次数 (assistant 消息数)",
  toolCalls: "工具调用总次数",
  errors: "工具执行报错 (isError) 计数",
} as const;

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
  timeline: { wallSeconds: number; timestampAdjusted: boolean };
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

/** Extract timestamp from an AgentMessage (all variants carry timestamp). */
function msgTimestamp(m: AgentMessage): number {
  return (m as { timestamp: number }).timestamp;
}

export function computeSessionMetrics(events: Entry[]): SessionMetrics {
  const messages = events
    .map((event, index) => ({ event, index }))
    .filter((x) => x.event.type === "message");
  const ts = (x: { event: Entry }) =>
    x.event.type === "message" ? msgTimestamp(x.event.message) : NaN;

  const timestampAdjusted =
    messages.some((x) => !Number.isFinite(ts(x))) ||
    messages.some(
      (x, i) =>
        i > 0 &&
        Number.isFinite(ts(x)) &&
        Number.isFinite(ts(messages[i - 1])) &&
        ts(x) < ts(messages[i - 1])
    );
  messages.sort((a, b) => {
    const at = ts(a),
      bt = ts(b);
    if (Number.isFinite(at) && Number.isFinite(bt))
      return at - bt || a.index - b.index;
    if (Number.isFinite(at)) return -1;
    if (Number.isFinite(bt)) return 1;
    return a.index - b.index;
  });
  let firstTs = Infinity,
    lastTs = -Infinity,
    modelRequests = 0,
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
  const assistantMsg: {
    ts: number;
    model: string;
    stopReason: string;
    input: number;
    output: number;
    tools: string[];
  }[] = [];
  for (const { event } of messages) {
    if (event.type !== "message") continue;
    const m = event.message;
    const mts = msgTimestamp(m);
    if (Number.isFinite(mts)) {
      firstTs = Math.min(firstTs, mts);
      lastTs = Math.max(lastTs, mts);
    }
    if (m.role === "assistant") {
      modelRequests++;
      tokens.input += m.usage?.input ?? 0;
      tokens.output += m.usage?.output ?? 0;
      tokens.cacheRead += m.usage?.cacheRead ?? 0;
      tokens.cacheWrite += m.usage?.cacheWrite ?? 0;
      tokens.reasoning += m.usage?.reasoning ?? 0;
      const tools: string[] = [];
      for (const part of m.content ?? [])
        if (part.type === "toolCall") {
          toolCalls++;
          toolCallCounts[part.name] = (toolCallCounts[part.name] ?? 0) + 1;
          tools.push(part.name);
        }
      assistantMsg.push({
        ts: mts,
        model: m.model,
        stopReason: m.stopReason,
        input: m.usage?.input ?? 0,
        output: m.usage?.output ?? 0,
        tools,
      });
    } else if (m.role === "toolResult" && m.isError) toolResultErrors++;
  }
  const rounds: SessionRound[] = assistantMsg.map((a, i) => ({
    model: a.model,
    stopReason: a.stopReason,
    input: a.input,
    output: a.output,
    elapsedMs:
      Number.isFinite(a.ts) &&
      Number.isFinite(
        i + 1 < assistantMsg.length ? assistantMsg[i + 1].ts : lastTs
      )
        ? Math.max(
            0,
            (i + 1 < assistantMsg.length ? assistantMsg[i + 1].ts : lastTs) -
              a.ts
          )
        : 0,
    tools: a.tools,
  }));
  const totalTokens = Object.values(tokens).reduce((a, b) => a + b, 0);
  return {
    timeline: {
      wallSeconds:
        firstTs === Infinity ? 0 : Math.round((lastTs - firstTs) / 100) / 10,
      timestampAdjusted,
    },
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
  score: RunDetail["score"]
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
  const sd = score?.score;
  const valid =
    !!sd &&
    [sd.total, sd.passed, sd.failed, sd.skipped].every(Number.isInteger) &&
    sd.total >= 0 &&
    sd.passed >= 0 &&
    sd.failed >= 0 &&
    sd.skipped >= 0 &&
    sd.passed + sd.failed + sd.skipped === sd.total;
  if (score?.status === "passed" && valid)
    ins.push({ level: "ok", text: `评测通过 ${sd.passed}/${sd.total}` });
  else if (score?.status === "passed")
    ins.push({
      level: "warn",
      text: "score 数据异常/未验证，无法确认通过数量",
    });
  else if (score?.status === "failed")
    ins.push({
      level: "err",
      text: `评测失败：${score.runtime?.failed?.join(", ") || "未知"}`,
    });
  return ins;
}
