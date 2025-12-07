import { z } from 'zod';

import {
  selectPermissionNodeSchema,
  insertPermissionNodeSchema,
  updatePermissionNodeSchema,
} from '../../../database/zod-schemas';

// 权限节点基础 Schema
export const PermissionNodeSchema = selectPermissionNodeSchema;

// 创建权限节点 Schema
export const CreatePermissionNodeSchema = insertPermissionNodeSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// 更新权限节点 Schema
export const UpdatePermissionNodeSchema = updatePermissionNodeSchema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .partial();

// 查询权限节点 Schema
export const PermissionNodeQuerySchema = z.object({
  module: z.string().optional(),
  isActive: z.boolean().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10),
});

// DTO 类
export type PermissionNodeDto = z.infer<typeof PermissionNodeSchema>;
export type CreatePermissionNodeDto = z.infer<typeof CreatePermissionNodeSchema>;
export type UpdatePermissionNodeDto = z.infer<typeof UpdatePermissionNodeSchema>;
export type PermissionNodeQueryDto = z.infer<typeof PermissionNodeQuerySchema>;

export type PermissionNodeType = z.infer<typeof PermissionNodeSchema>;
export type CreatePermissionNodeType = z.infer<typeof CreatePermissionNodeSchema>;
export type UpdatePermissionNodeType = z.infer<typeof UpdatePermissionNodeSchema>;
export type PermissionNodeQueryType = z.infer<typeof PermissionNodeQuerySchema>;
