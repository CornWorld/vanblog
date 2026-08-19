// API client + types for the artifacts-server.

export interface RunSummary {
  id: string;
  state: "open" | "closed";
  closedNote: string | null;
  mtime: string;
  model: string | null;
  exitReason: string | null;
  timedOut: boolean | null;
  isolationPassed: boolean | null;
  evalStatus: string | null;
  evalScore: string | null;
  evalPct: number | null;
  evalSummary: string | null;
  requests: number | null;
  toolCalls: number | null;
  tokens: number | null;
  wallSeconds: number | null;
}

export interface Score {
  status?: string;
  summary?: string;
  score?: { total: number; passed: number; failed: number; skipped: number; pct: number };
  static?: { passed: string[]; failed: string[]; skipped: string[] };
  runtime?: { passed: string[]; failed: string[]; blocked: string[] };
}

export interface RunDetail extends RunSummary {
  run: Record<string, unknown>;
  score: Score | null;
  metrics: {
    agent?: { modelRequestCount?: number; toolCallCount?: number; toolResultErrorCount?: number; toolCallCounts?: Record<string, number> };
    tokens?: { totalTokens?: number; cacheRead?: number };
    timeline?: { wallSeconds?: number };
  } | null;
  transcript: string | null;
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

export const api = {
  runs: () => get<RunSummary[]>("/api/runs"),
  run: (id: string) => get<RunDetail>(`/api/runs/${id}`),
  file: async (id: string, path: string): Promise<string> => {
    const res = await fetch(`/api/runs/${id}/file?path=${encodeURIComponent(path)}`);
    if (!res.ok) return `(no ${path})`;
    return res.text();
  },
};
