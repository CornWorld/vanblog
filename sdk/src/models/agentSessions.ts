import { z } from "zod";
import {
  IsoDateTimeSchema,
  RecordIdSchema,
  SystemFieldsSchema,
} from "./common";

// Mirrors vault/pb_migrations/1783600000_create_agent_sessions.go.
// agent_sessions stores durable metadata for the platform agent RPC runtime;
// the engine (pi/omp) owns only the session transcript files on disk.
export const AgentSessionSchema = SystemFieldsSchema.extend({
  owner: RecordIdSchema,
  status: z.enum(["active", "idle", "error", "expired"]),
  sessionDir: z.string().min(1),
  processId: z.number().int().optional(),
  lastActivityAt: IsoDateTimeSchema.optional(),
  expiresAt: IsoDateTimeSchema.optional(),
});
export type AgentSession = z.infer<typeof AgentSessionSchema>;
