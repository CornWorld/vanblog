// API client + types for the artifacts-server.

export interface RunSummary {
  id: string;
  state: "open" | "closed";
  closedNote: string | null;
  mtime: string;
  model: string | null;
  exitReason: string | null;
  evalStatus: string | null;
  evalScore: string | null;
  requests: number | null;
  toolCalls: number | null;
  tokens: number | null;
  wallSeconds: number | null;
}

export interface Score {
  status?: string;
  summary?: string;
  score?: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    pct: number;
  };
  static?: { passed: string[]; failed: string[]; skipped: string[] };
  runtime?: { passed: string[]; failed: string[]; blocked: string[] };
}

export interface RunDetail extends RunSummary {
  run: Record<string, unknown>;
  score: Score | null;
  transcript: string | null;
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

// ── Session event types (raw pi session JSONL) ──

/** A single session event as recorded by pi's --session-dir. */
export type SessionEvent =
  | { type: "session"; id: string }
  | { type: "model_change"; modelId: string; provider: string }
  | { type: "thinking_level_change"; level: string | null }
  | { type: "message"; message: SessionMessage };

export type SessionMessage =
  | { role: "user"; content: string; timestamp: number }
  | {
      role: "assistant";
      content: AssistantContent[];
      usage: {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
        reasoning: number;
      };
      stopReason: string;
      model: string;
      provider: string;
      timestamp: number;
    }
  | {
      role: "toolResult";
      content: ToolResultContent[];
      toolName: string;
      isError: boolean;
      timestamp: number;
    };

export type AssistantContent =
  | { type: "text"; text: string }
  | { type: "toolCall"; id: string; name: string; args: unknown };

export type ToolResultContent =
  | { type: "text"; text: string }
  | { type: "resource"; resource: unknown };

export const api = {
  runs: () => get<RunSummary[]>("/api/runs"),
  run: (id: string) => get<RunDetail>(`/api/runs/${id}`),
  session: (id: string) => get<SessionEvent[]>(`/api/runs/${id}/session`),
  file: async (id: string, path: string): Promise<string> => {
    const res = await fetch(
      `/api/runs/${id}/file?path=${encodeURIComponent(path)}`
    );
    if (!res.ok) return `(no ${path})`;
    return res.text();
  },
};
