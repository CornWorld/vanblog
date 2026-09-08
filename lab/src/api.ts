// API client + types for the artifacts-server.
// Session event types are imported from @earendil-works/pi-agent-core
// instead of hand-written, to stay in sync with pi's session JSONL format.

import type { Entry } from "@earendil-works/pi-agent-core";

export type { Entry, MessageEntry } from "@earendil-works/pi-agent-core";

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
  langfuse: { enabled: boolean; host: string } | null;
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

export interface JobEntry {
  id: string;
  at: string;
  target: string;
  seed: boolean;
  cleanup: boolean;
  status: "running" | "done";
  pid?: number;
  findings?: number;
}

export interface LastRunFinding {
  info?: { name?: string; severity?: string };
  matched_at?: string;
  host?: string;
}

export interface LastRun {
  target: string;
  at: string;
  seeded: { catId: string; postId: string } | null;
  findings: LastRunFinding[];
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

export const api = {
  runs: () => get<RunSummary[]>("/api/runs"),
  run: (id: string) => get<RunDetail>(`/api/runs/${id}`),
  session: (id: string) => get<Entry[]>(`/api/runs/${id}/session`),
  jobs: () => get<JobEntry[]>("/api/jobs"),
  lastRun: () => get<LastRun | null>("/api/jobs/last"),
  runJob: (body: { target: string; seed: boolean; cleanup: boolean }) =>
    post<JobEntry>("/api/jobs/run", body),
  file: async (id: string, path: string): Promise<string> => {
    const res = await fetch(
      `/api/runs/${id}/file?path=${encodeURIComponent(path)}`
    );
    if (!res.ok) {
      throw new Error(`${res.url} → ${res.status} ${res.statusText}`);
    }
    return res.text();
  },
};
