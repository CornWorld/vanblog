import { pipelines } from '@vanblog/shared/drizzle';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// ========== Select Schemas ==========
export const PipelineSchema = createSelectSchema(pipelines);

export const PipelineListResponseSchema = z.object({
  items: z.array(PipelineSchema),
  total: z.number(),
});

// ========== Insert/Update Schemas ==========
export const CreatePipelineSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  eventName: z.string().min(1),
  script: z.string().min(1),
  deps: z.array(z.string()).default([]),
});

export const UpdatePipelineSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
  eventName: z.string().min(1).optional(),
  script: z.string().min(1).optional(),
  deps: z.array(z.string()).optional(),
});

// ========== Query Schemas ==========
export const PipelineQuerySchema = z.object({
  eventName: z.string().optional(),
  enabled: z.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ========== Trigger Schemas ==========
export const TriggerPipelineSchema = z.object({
  input: z.any().optional(),
});

export const PipelineExecutionResultSchema = z.object({
  status: z.enum(['success', 'error']),
  logs: z.array(z.string()),
  output: z.any(),
});

// ========== Type Exports ==========
export type Pipeline = z.infer<typeof PipelineSchema>;
export type PipelineListResponse = z.infer<typeof PipelineListResponseSchema>;
export type CreatePipeline = z.infer<typeof CreatePipelineSchema>;
export type UpdatePipeline = z.infer<typeof UpdatePipelineSchema>;
export type PipelineQuery = z.infer<typeof PipelineQuerySchema>;
export type TriggerPipeline = z.infer<typeof TriggerPipelineSchema>;
export type PipelineExecutionResult = z.infer<typeof PipelineExecutionResultSchema>;
