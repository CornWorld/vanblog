import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Base schemas for validation
const CreateCodeSnippetSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  hookName: z.string().min(1).max(255),
  hookType: z.enum(['action', 'filter']).default('action'),
  priority: z.number().int().min(1).max(100).default(10),
  code: z.string().min(1),
  enabled: z.boolean().default(true),
  timeout: z.number().int().min(100).max(60000).default(5000),
});

const UpdateCodeSnippetSchema = CreateCodeSnippetSchema.partial();

const CodeSnippetQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
  hookName: z.string().optional(),
  hookType: z.enum(['action', 'filter']).optional(),
  enabled: z.boolean().optional(),
  search: z.string().optional(),
});

const CodeSnippetExecuteSchema = z.object({
  data: z.any().optional(),
  args: z.array(z.any()).optional(),
});

// DTOs
export class CreateCodeSnippetDto extends createZodDto(CreateCodeSnippetSchema) {}
export class UpdateCodeSnippetDto extends createZodDto(UpdateCodeSnippetSchema) {}
export class CodeSnippetQueryDto extends createZodDto(CodeSnippetQuerySchema) {}
export class CodeSnippetExecuteDto extends createZodDto(CodeSnippetExecuteSchema) {}

// Response DTOs
export const CodeSnippetResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  hookName: z.string(),
  hookType: z.enum(['action', 'filter']),
  priority: z.number(),
  code: z.string(),
  enabled: z.boolean(),
  timeout: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CodeSnippetListResponseSchema = z.object({
  data: z.array(CodeSnippetResponseSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

export const CodeSnippetExecuteResponseSchema = z.object({
  success: z.boolean(),
  result: z.any().optional(),
  error: z.string().optional(),
  executionTime: z.number(),
});

export class CodeSnippetResponseDto extends createZodDto(CodeSnippetResponseSchema) {}
export class CodeSnippetListResponseDto extends createZodDto(CodeSnippetListResponseSchema) {}
export class CodeSnippetExecuteResponseDto extends createZodDto(CodeSnippetExecuteResponseSchema) {}
