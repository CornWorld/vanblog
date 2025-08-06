import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  selectPermissionNodeSchema,
  insertPermissionNodeSchema,
  updatePermissionNodeSchema,
} from '../../../database/zod-schemas';

// 权限节点基础 Schema
export const PermissionNodeSchema = selectPermissionNodeSchema;

// 创建权限节点 Schema
export const CreatePermissionNodeSchema = insertPermissionNodeSchema;

// 更新权限节点 Schema
export const UpdatePermissionNodeSchema = updatePermissionNodeSchema.partial();

// 查询权限节点 Schema
export const PermissionNodeQuerySchema = z.object({
  module: z.string().optional(),
  isActive: z.boolean().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10),
});

// DTO 类
export class PermissionNodeDto extends createZodDto(PermissionNodeSchema) {}
export class CreatePermissionNodeDto extends createZodDto(CreatePermissionNodeSchema) {}
export class UpdatePermissionNodeDto extends createZodDto(UpdatePermissionNodeSchema) {}
export class PermissionNodeQueryDto extends createZodDto(PermissionNodeQuerySchema) {}

export type PermissionNodeType = z.infer<typeof PermissionNodeSchema>;
export type CreatePermissionNodeType = z.infer<typeof CreatePermissionNodeSchema>;
export type UpdatePermissionNodeType = z.infer<typeof UpdatePermissionNodeSchema>;
export type PermissionNodeQueryType = z.infer<typeof PermissionNodeQuerySchema>;
