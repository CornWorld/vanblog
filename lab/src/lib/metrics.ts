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

// ── trace model: langfuse-style timeline data for session detail view ──

// A single content block within an assistant message, categorized
export interface TraceContentBlock {
  type: "thinking" | "text" | "toolCall" | "image";
  // For thinking blocks
  thinking?: string;
  thinkingSignature?: string;
  // For text blocks
  text?: string;
  // For toolCall blocks
  toolCallId?: string;
  toolName?: string;
  arguments?: unknown;
  // For image blocks
  source?: unknown;
}

// A tool result associated with a toolCall in a TraceStep
export interface TraceToolResult {
  toolCallId: string;
  toolName: string;
  isError: boolean;
  content: { type: "text" | "image"; text?: string; source?: unknown }[];
  timestamp: number;
}

// One assistant turn = one step in the trace timeline
export interface TraceStep {
  // Entry-level metadata
  entryId: string;
  parentId: string | null;
  timestamp: number; // ms epoch, normalized
  // Assistant message fields
  model: string;
  provider: string;
  api: string;
  stopReason: string;
  responseId?: string;
  responseModel?: string;
  rawStopReason?: string;
  // Content blocks split by type
  thinkingBlocks: TraceContentBlock[];
  textBlocks: TraceContentBlock[];
  toolCallBlocks: TraceContentBlock[];
  // Tool results associated with this step's tool calls (matched by toolCallId)
  toolResults: TraceToolResult[];
  // Usage
  usage: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    reasoning: number;
    totalTokens: number;
    cost: {
      input: number;
      output: number;
      cacheRead: number;
      cacheWrite: number;
      total: number;
    };
  };
  // Derived timing: elapsed from this step's timestamp to the next step's timestamp (or last event timestamp)
  elapsedMs: number;
}

// Config events that happen between steps (model changes, thinking level changes, compactions, etc.)
export interface ConfigEvent {
  type:
    | "model_change"
    | "thinking_level_change"
    | "compaction"
    | "branch_summary"
    | "active_tools_change"
    | "custom";
  entryId: string;
  timestamp: number;
  // Type-specific payload
  modelChange?: { provider: string; modelId: string };
  thinkingLevel?: string;
  compaction?: {
    summary: string;
    tokensBefore: number;
    retainedTailLength: number;
  };
  branchSummary?: { fromId: string; summary: string };
  activeTools?: string[];
  customType?: string;
  data?: unknown;
}

// A user message in the trace (the initial prompt or follow-up injections)
export interface TraceUserMessage {
  entryId: string;
  timestamp: number;
  text: string; // concatenated text blocks
}

// The complete trace: timeline of steps + config events + user messages, all in chronological order
export interface SessionTrace {
  sessionId: string;
  sessionTimestamp: number; // first entry timestamp
  steps: TraceStep[]; // assistant turns, in chronological order
  configEvents: ConfigEvent[]; // model changes, compactions, etc.
  userMessages: TraceUserMessage[]; // user inputs
  totalCost: number; // sum of all step usage.cost.total
  lastTimestamp: number; // last event timestamp, for elapsedMs calculation
  timeline: TraceTimelineItem[]; // merged sorted timeline of all items
}

// Union for the merged timeline
export type TraceTimelineItem =
  | { kind: "user"; item: TraceUserMessage }
  | { kind: "step"; item: TraceStep }
  | { kind: "config"; item: ConfigEvent };

/**
 * Normalize an entry-level timestamp to ms epoch.
 * The Entry type declares timestamp as number, but JSONL data may contain
 * ISO strings at runtime. This helper handles both.
 */
function normalizeTimestamp(raw: number | string): number {
  if (typeof raw === "number") return raw;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function buildSessionTrace(events: Entry[]): SessionTrace | null {
  // 1. Empty or no messages → null
  if (events.length === 0) return null;
  const hasMessages = events.some((e) => e.type === "message");
  if (!hasMessages) return null;

  // 2. Find session entry (type === "session"); may not exist in Entry union
  const sessionEntry = events.find((e) => (e.type as string) === "session") as
    | (Entry & { sessionId?: string })
    | undefined;
  const sessionId = sessionEntry?.sessionId ?? events[0].id;
  const sessionTimestamp = sessionEntry
    ? normalizeTimestamp(sessionEntry.timestamp)
    : normalizeTimestamp(events[0].timestamp);

  // 4. Sort all entries by entry-level timestamp, original index as tiebreaker
  const sorted = events
    .map((entry, index) => ({
      entry,
      index,
      ts: normalizeTimestamp(entry.timestamp),
    }))
    .sort((a, b) => a.ts - b.ts || a.index - b.index);

  // 5. Build toolCallId → TraceToolResult map by scanning toolResult messages
  const toolResultMap = new Map<string, TraceToolResult>();
  for (const { entry } of sorted) {
    if (entry.type !== "message") continue;
    const m = entry.message;
    if (m.role !== "toolResult") continue;
    const tr: TraceToolResult = {
      toolCallId: m.toolCallId,
      toolName: m.toolName,
      isError: m.isError,
      content: (m.content ?? []).map((c) =>
        c.type === "text"
          ? { type: "text" as const, text: c.text }
          : { type: "image" as const, source: c }
      ),
      timestamp: m.timestamp,
    };
    toolResultMap.set(m.toolCallId, tr);
  }

  // 6. Iterate through sorted entries and build steps/configEvents/userMessages
  const steps: TraceStep[] = [];
  const configEvents: ConfigEvent[] = [];
  const userMessages: TraceUserMessage[] = [];

  for (const { entry, ts } of sorted) {
    if (entry.type === "message") {
      const m = entry.message;

      if (m.role === "user") {
        // Concatenate text blocks' text (content can be string or array)
        let text = "";
        const content = m.content;
        if (typeof content === "string") {
          text = content;
        } else if (Array.isArray(content)) {
          text = content
            .filter((c) => c.type === "text")
            .map((c) => c.text)
            .join("");
        }
        userMessages.push({ entryId: entry.id, timestamp: ts, text });
      } else if (m.role === "assistant") {
        const thinkingBlocks: TraceContentBlock[] = [];
        const textBlocks: TraceContentBlock[] = [];
        const toolCallBlocks: TraceContentBlock[] = [];
        const toolResults: TraceToolResult[] = [];

        for (const block of m.content ?? []) {
          if (block.type === "thinking") {
            thinkingBlocks.push({
              type: "thinking",
              thinking: block.thinking,
              thinkingSignature: block.thinkingSignature,
            });
          } else if (block.type === "text") {
            textBlocks.push({ type: "text", text: block.text });
          } else if (block.type === "toolCall") {
            toolCallBlocks.push({
              type: "toolCall",
              toolCallId: block.id,
              toolName: block.name,
              arguments: block.arguments,
            });
            const tr = toolResultMap.get(block.id);
            if (tr) toolResults.push(tr);
          }
          // image and other block types are not collected (no array in TraceStep)
        }

        steps.push({
          entryId: entry.id,
          parentId: entry.parentId,
          timestamp: ts,
          model: m.model,
          provider: m.provider,
          api: m.api,
          stopReason: m.stopReason,
          responseId: m.responseId,
          responseModel: m.responseModel,
          rawStopReason: m.rawStopReason,
          thinkingBlocks,
          textBlocks,
          toolCallBlocks,
          toolResults,
          usage: {
            input: m.usage?.input ?? 0,
            output: m.usage?.output ?? 0,
            cacheRead: m.usage?.cacheRead ?? 0,
            cacheWrite: m.usage?.cacheWrite ?? 0,
            reasoning: m.usage?.reasoning ?? 0,
            totalTokens: m.usage?.totalTokens ?? 0,
            cost: {
              input: m.usage?.cost?.input ?? 0,
              output: m.usage?.cost?.output ?? 0,
              cacheRead: m.usage?.cost?.cacheRead ?? 0,
              cacheWrite: m.usage?.cost?.cacheWrite ?? 0,
              total: m.usage?.cost?.total ?? 0,
            },
          },
          elapsedMs: 0, // calculated below
        });
      }
      // toolResult messages already processed into toolResultMap; other roles ignored
    } else if (entry.type === "model_change") {
      configEvents.push({
        type: "model_change",
        entryId: entry.id,
        timestamp: ts,
        modelChange: { provider: entry.provider, modelId: entry.modelId },
      });
    } else if (entry.type === "thinking_level_change") {
      configEvents.push({
        type: "thinking_level_change",
        entryId: entry.id,
        timestamp: ts,
        thinkingLevel: entry.thinkingLevel,
      });
    } else if (entry.type === "compaction") {
      configEvents.push({
        type: "compaction",
        entryId: entry.id,
        timestamp: ts,
        compaction: {
          summary: entry.summary,
          tokensBefore: entry.tokensBefore,
          retainedTailLength: entry.retainedTail.length,
        },
      });
    } else if (entry.type === "branch_summary") {
      configEvents.push({
        type: "branch_summary",
        entryId: entry.id,
        timestamp: ts,
        branchSummary: { fromId: entry.fromId, summary: entry.summary },
      });
    } else if (entry.type === "active_tools_change") {
      configEvents.push({
        type: "active_tools_change",
        entryId: entry.id,
        timestamp: ts,
        activeTools: entry.activeToolNames,
      });
    } else if (entry.type === "custom") {
      configEvents.push({
        type: "custom",
        entryId: entry.id,
        timestamp: ts,
        customType: entry.customType,
        data: entry.data,
      });
    }
    // session and unknown types are ignored
  }

  // 7. Calculate elapsedMs for each step
  const lastTimestamp = sorted.length > 0 ? sorted[sorted.length - 1].ts : 0;
  for (let i = 0; i < steps.length; i++) {
    const nextTs =
      i + 1 < steps.length ? steps[i + 1].timestamp : lastTimestamp;
    steps[i].elapsedMs = Math.max(0, nextTs - steps[i].timestamp);
  }

  // 8. Build merged timeline (sort all items by timestamp)
  const timeline: TraceTimelineItem[] = [
    ...userMessages.map((item) => ({ kind: "user" as const, item })),
    ...steps.map((item) => ({ kind: "step" as const, item })),
    ...configEvents.map((item) => ({ kind: "config" as const, item })),
  ].sort((a, b) => a.item.timestamp - b.item.timestamp);

  // 9. Calculate totalCost
  const totalCost = steps.reduce((sum, s) => sum + s.usage.cost.total, 0);

  // 10. Return the SessionTrace
  return {
    sessionId,
    sessionTimestamp,
    steps,
    configEvents,
    userMessages,
    totalCost,
    lastTimestamp,
    timeline,
  };
}
