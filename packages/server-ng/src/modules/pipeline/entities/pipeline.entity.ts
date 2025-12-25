import type { PipelineSchema } from '../dto/pipeline.dto';
import type { z } from 'zod';

/**
 * Pipeline Entity
 *
 * Represents a pipeline with executable JavaScript code that can be triggered
 * by system events or manually.
 */
export class Pipeline {
  id: number;
  name: string;
  description?: string | null;
  enabled: boolean;
  eventName: string;
  script: string;
  deps: string[];
  status: 'idle' | 'running' | 'success' | 'error';
  lastRun?: string | null;
  lastStatus?: string | null;
  lastError?: string | null;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;

  constructor(data: z.infer<typeof PipelineSchema>) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.enabled = data.enabled;
    this.eventName = data.eventName;
    this.script = data.script;
    this.deps = data.deps || [];
    this.status = data.status;
    this.lastRun = data.lastRun;
    this.lastStatus = data.lastStatus;
    this.lastError = data.lastError;
    this.deleted = data.deleted;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}
