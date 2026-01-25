import {
  selectPermissionNodeSchema,
  insertPermissionNodeSchema,
  updatePermissionNodeSchema,
} from '@vanblog/shared/drizzle';
import { z } from 'zod';

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

// DTO 类型别名（用于服务层）
export type PermissionNodeDto = z.infer<typeof PermissionNodeSchema>;
export type PermissionNodeQueryType = z.infer<typeof PermissionNodeQuerySchema>;

export type PermissionNodeType = z.infer<typeof PermissionNodeSchema>;
export type CreatePermissionNodeType = z.infer<typeof CreatePermissionNodeSchema>;
export type UpdatePermissionNodeType = z.infer<typeof UpdatePermissionNodeSchema>;

// DTO 类（用于装饰器参数，支持 isolatedModules）
export class CreatePermissionNodeDto {
  name!: string;
  module!: string;
  description?: string;
  isActive!: boolean;
}

export class UpdatePermissionNodeDto {
  name?: string;
  module?: string;
  description?: string;
  isActive?: boolean;
}

export class PermissionNodeQueryDto {
  module?: string;
  isActive?: boolean;
  page: number = 1;
  limit: number = 10;
}
