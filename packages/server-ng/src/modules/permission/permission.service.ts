import { Injectable, NotFoundException, Logger, Inject } from '@nestjs/common';
import dayjs from 'dayjs';
import { eq, desc, and } from 'drizzle-orm';

import { DATABASE_CONNECTION } from '../../database/database.module';
import { permissionNodes, permissionGroups } from '../../database/schema';

import {
  CreatePermissionGroupType,
  UpdatePermissionGroupType,
  PermissionGroupQueryType,
  PermissionGroupType,
} from './dto/permission-group.dto';
import {
  CreatePermissionNodeType,
  UpdatePermissionNodeType,
  PermissionNodeQueryType,
  PermissionNodeType,
} from './dto/permission-node.dto';

import type { Database } from '../../database/connection';

export interface PermissionRegistration {
  module: string;
  permissions?: string[];
  roles?: Record<string, string[]>;
}

export interface ModulePermissionInfo {
  fullPermissions: string[];
  semanticPermissions: string[];
}

@Injectable()
export class PermissionService {
  private readonly logger = new Logger(PermissionService.name);
  private readonly registeredPermissions = new Map<string, PermissionNodeType>();
  private readonly modulePermissions = new Map<string, string[]>();
  private readonly predefinedRoles = new Map<string, string[]>();
  private readonly moduleContext = new Map<string, string[]>();

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {
    // 初始化预定义权限组
    this.initializePredefinedGroups();
  }

  /**
   * 初始化预定义角色
   */
  private initializePredefinedGroups(): void {
    // 这些是基础的角色，各模块可以通过 register 方法添加更多
    this.predefinedRoles.set('admin', []);
    this.predefinedRoles.set('editor', []);
    this.predefinedRoles.set('author', []);
    this.predefinedRoles.set('viewer', []);
  }

  /**
   * 注册模块权限和角色权限
   * @param config 权限注册配置
   */
  register(config: PermissionRegistration): void {
    const { module, permissions = [], roles = {} } = config;

    this.logger.log(`模块 ${module} 的已注册权限`);

    // 注册模块权限节点（带前缀）
    const fullPermissions = permissions.map((p) => `${module}:${p}`);
    this.modulePermissions.set(module, fullPermissions);

    // 存储模块上下文，用于权限名称映射
    this.moduleContext.set(module, permissions);

    // 注册角色权限
    Object.entries(roles).forEach(([roleName, rolePermissions]) => {
      const fullRolePermissions = rolePermissions.map((p) => `${module}:${p}`);
      const existingPermissions = this.predefinedRoles.get(roleName) ?? [];
      this.predefinedRoles.set(roleName, [...existingPermissions, ...fullRolePermissions]);
      this.logger.log(`注册角色 ${roleName} 的权限: ${fullRolePermissions.join(', ')}`);
    });

    this.logger.log(`模块 ${module} 权限注册完成: ${fullPermissions.join(', ')}`);
  }

  /**
   * 解析语义化权限名称
   * @param module 模块名称
   * @param permissions 权限列表（可能包含语义化名称）
   */
  resolvePermissionNames(module: string, permissions: string[]): string[] {
    const modulePermissions = this.moduleContext.get(module) ?? [];

    return permissions.map((permission) => {
      // 如果已经是完整格式，直接返回
      if (permission.includes(':')) {
        return permission;
      }

      // 如果是语义化名称且在模块权限中，添加模块前缀
      if (modulePermissions.includes(permission)) {
        return `${module}:${permission}`;
      }

      // 否则返回原始权限名称
      return permission;
    });
  }

  /**
   * 获取特定模块的所有权限
   * @param module 模块名称
   * @returns 模块的所有权限列表（完整格式）
   */
  getModulePermissions(module: string): string[] {
    return this.modulePermissions.get(module) ?? [];
  }

  /**
   * 获取特定模块的语义化权限名称
   * @param module 模块名称
   * @returns 模块的语义化权限名称列表
   */
  getModuleSemanticPermissions(module: string): string[] {
    return this.moduleContext.get(module) ?? [];
  }

  /**
   * 获取所有已注册模块的权限信息
   * @returns 模块权限映射表
   */
  getAllModulePermissions(): Record<string, ModulePermissionInfo> {
    const result: Record<string, ModulePermissionInfo> = {};

    for (const [module] of this.modulePermissions) {
      result[module] = {
        fullPermissions: this.getModulePermissions(module),
        semanticPermissions: this.getModuleSemanticPermissions(module),
      };
    }

    return result;
  }

  /**
   * 注册权限节点
   * @param permission 权限节点信息
   */
  async registerPermission(
    permission: Omit<CreatePermissionNodeType, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<void> {
    const key = `${permission.module}:${permission.name}`;
    if (this.registeredPermissions.has(key)) {
      return;
    }

    try {
      const existingPermission = await this.db
        .select()
        .from(permissionNodes)
        .where(eq(permissionNodes.name, permission.name))
        .limit(1);

      if (existingPermission.length === 0) {
        const newPermission = await this.createPermissionNode(permission);
        this.registeredPermissions.set(key, newPermission);
      } else {
        this.registeredPermissions.set(key, {
          ...existingPermission[0],
          createdAt: dayjs(existingPermission[0].createdAt),
          updatedAt: dayjs(existingPermission[0].updatedAt),
        });
      }
    } catch (error) {
      this.logger.error(`Failed to register permission ${permission.name}:`, error);
    }
  }

  /**
   * 解析用户权限，处理禁用权限和权限组（顺序敏感：后者覆盖前者）
   */
  async resolveUserPermissions(userPermissions: string[]): Promise<string[]> {
    const resolvedPermissions = new Set<string>();

    for (const token of userPermissions) {
      if (token === 'all') {
        // 特殊权限：all
        resolvedPermissions.add('all');
        continue;
      }

      if (token.startsWith('no:')) {
        // 撤销权限或角色
        const target = token.slice(3);
        if (target.startsWith('role:')) {
          const roleName = target.slice(5);
          const rolePermissions = await this.getRolePermissions(roleName);
          for (const p of rolePermissions) {
            resolvedPermissions.delete(p);
          }
        } else {
          resolvedPermissions.delete(target);
        }
        continue;
      }

      if (token.startsWith('role:')) {
        // 角色展开（添加权限）
        const roleName = token.slice(5);
        const rolePermissions = await this.getRolePermissions(roleName);
        for (const p of rolePermissions) {
          resolvedPermissions.add(p);
        }
        continue;
      }

      // 普通权限：直接添加
      resolvedPermissions.add(token);
    }

    return Array.from(resolvedPermissions);
  }

  /**
   * 检查用户是否拥有指定权限
   */
  async hasPermissions(userPermissions: string[], requiredPermissions: string[]): Promise<boolean> {
    const resolvedPermissions = await this.resolveUserPermissions(userPermissions);

    return requiredPermissions.every(
      (required) => resolvedPermissions.includes(required) || resolvedPermissions.includes('all'),
    );
  }

  // CRUD 操作 - 权限节点
  async createPermissionNode(
    createPermissionNodeDto: CreatePermissionNodeType,
  ): Promise<PermissionNodeType> {
    const [result] = await this.db
      .insert(permissionNodes)
      .values(createPermissionNodeDto)
      .returning();
    return {
      ...result,
      createdAt: dayjs(result.createdAt),
      updatedAt: dayjs(result.updatedAt),
    };
  }

  async findAllPermissionNodes(query: PermissionNodeQueryType): Promise<PermissionNodeType[]> {
    const conditions = [];

    if (query.module) {
      conditions.push(eq(permissionNodes.module, query.module));
    }

    if (query.isActive !== undefined) {
      conditions.push(eq(permissionNodes.isActive, query.isActive));
    }

    if (conditions.length === 0) {
      const results = await this.db
        .select()
        .from(permissionNodes)
        .orderBy(desc(permissionNodes.createdAt))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit);
      return results.map((node) => ({
        ...node,
        createdAt: dayjs(node.createdAt),
        updatedAt: dayjs(node.updatedAt),
      }));
    }

    if (conditions.length === 1) {
      const results = await this.db
        .select()
        .from(permissionNodes)
        .where(conditions[0])
        .orderBy(desc(permissionNodes.createdAt))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit);
      return results.map((node) => ({
        ...node,
        createdAt: dayjs(node.createdAt),
        updatedAt: dayjs(node.updatedAt),
      }));
    }

    const results = await this.db
      .select()
      .from(permissionNodes)
      .where(and(...conditions))
      .orderBy(desc(permissionNodes.createdAt))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);
    return results.map((node) => ({
      ...node,
      createdAt: dayjs(node.createdAt),
      updatedAt: dayjs(node.updatedAt),
    }));
  }

  async findPermissionNodeById(id: number): Promise<PermissionNodeType> {
    const result = await this.db
      .select()
      .from(permissionNodes)
      .where(eq(permissionNodes.id, id))
      .limit(1);

    if (result.length === 0) {
      throw new NotFoundException(`Permission node with ID ${String(id)} not found`);
    }

    return {
      ...result[0],
      createdAt: dayjs(result[0].createdAt),
      updatedAt: dayjs(result[0].updatedAt),
    };
  }

  async updatePermissionNode(
    id: number,
    updatePermissionNodeDto: UpdatePermissionNodeType,
  ): Promise<PermissionNodeType> {
    const result = await this.db
      .update(permissionNodes)
      .set({ ...updatePermissionNodeDto, updatedAt: dayjs().toISOString() })
      .where(eq(permissionNodes.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Permission node with ID ${String(id)} not found`);
    }

    return {
      ...result[0],
      createdAt: dayjs(result[0].createdAt),
      updatedAt: dayjs(result[0].updatedAt),
    };
  }

  async removePermissionNode(id: number): Promise<void> {
    const result = await this.db.delete(permissionNodes).where(eq(permissionNodes.id, id));

    if (result.rowsAffected === 0) {
      throw new NotFoundException(`Permission node with ID ${String(id)} not found`);
    }
  }

  // CRUD 操作 - 权限组
  async createPermissionGroup(
    createPermissionGroupDto: CreatePermissionGroupType,
  ): Promise<PermissionGroupType> {
    const [result] = await this.db
      .insert(permissionGroups)
      .values(createPermissionGroupDto)
      .returning();
    return {
      ...result,
      permissions: result.permissions ? (JSON.parse(result.permissions) as string[]) : null,
      createdAt: dayjs(result.createdAt),
      updatedAt: dayjs(result.updatedAt),
    };
  }

  async findAllPermissionGroups(query: PermissionGroupQueryType): Promise<PermissionGroupType[]> {
    let results;

    if (query.isActive !== undefined) {
      results = await this.db
        .select()
        .from(permissionGroups)
        .where(eq(permissionGroups.isActive, query.isActive))
        .orderBy(desc(permissionGroups.createdAt))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit);
    } else {
      results = await this.db
        .select()
        .from(permissionGroups)
        .orderBy(desc(permissionGroups.createdAt))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit);
    }

    return results.map((group) => ({
      ...group,
      permissions: group.permissions ? (JSON.parse(group.permissions) as string[]) : null,
      createdAt: dayjs(group.createdAt),
      updatedAt: dayjs(group.updatedAt),
    }));
  }

  async findPermissionGroupById(id: number): Promise<PermissionGroupType> {
    const result = await this.db
      .select()
      .from(permissionGroups)
      .where(eq(permissionGroups.id, id))
      .limit(1);

    if (result.length === 0) {
      throw new NotFoundException(`Permission group with ID ${String(id)} not found`);
    }

    return {
      ...result[0],
      permissions: result[0].permissions ? (JSON.parse(result[0].permissions) as string[]) : null,
      createdAt: dayjs(result[0].createdAt),
      updatedAt: dayjs(result[0].updatedAt),
    };
  }

  async updatePermissionGroup(
    id: number,
    updatePermissionGroupDto: UpdatePermissionGroupType,
  ): Promise<PermissionGroupType> {
    const result = await this.db
      .update(permissionGroups)
      .set({ ...updatePermissionGroupDto, updatedAt: dayjs().toISOString() })
      .where(eq(permissionGroups.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Permission group with ID ${String(id)} not found`);
    }

    return {
      ...result[0],
      permissions: result[0].permissions ? (JSON.parse(result[0].permissions) as string[]) : null,
      createdAt: dayjs(result[0].createdAt),
      updatedAt: dayjs(result[0].updatedAt),
    };
  }

  async removePermissionGroup(id: number): Promise<void> {
    const result = await this.db.delete(permissionGroups).where(eq(permissionGroups.id, id));

    if (result.rowsAffected === 0) {
      throw new NotFoundException(`Permission group with ID ${String(id)} not found`);
    }
  }

  /**
   * 初始化权限系统 - 在程序启动时自动注册权限节点和创建权限组
   */
  async initializePermissions(): Promise<void> {
    this.logger.log('开始初始化权限系统...');

    try {
      // 1. 注册所有模块的权限节点
      await this.registerAllModulePermissions();

      // 2. 创建预定义的权限组
      await this.createPredefinedGroups();

      this.logger.log('权限系统初始化完成');
    } catch (error) {
      this.logger.error('权限系统初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取角色的权限列表
   * @param roleName 角色名称
   * @returns 权限列表
   */
  private async getRolePermissions(roleName: string): Promise<string[]> {
    // 移除 'role:' 前缀
    const actualRoleName = roleName.replace('role:', '');

    // 从预定义角色中获取权限
    const predefinedPermissions = this.predefinedRoles.get(actualRoleName);
    if (predefinedPermissions) {
      return predefinedPermissions;
    }

    // 如果不是预定义角色，从数据库查询
    const group = await this.db
      .select()
      .from(permissionGroups)
      .where(eq(permissionGroups.name, actualRoleName))
      .limit(1);

    if (group.length === 0) {
      return [];
    }

    return group[0].permissions ? (JSON.parse(group[0].permissions) as string[]) : [];
  }

  /**
   * 注册所有模块的权限节点
   */
  private async registerAllModulePermissions(): Promise<void> {
    for (const [moduleName, permissions] of this.modulePermissions.entries()) {
      this.logger.log(`注册模块 ${moduleName} 的权限节点...`);

      for (const permission of permissions) {
        await this.registerPermission({
          name: permission,
          description: `${moduleName} 模块的 ${permission.split(':')[1]} 权限`,
          module: moduleName,
        });
      }
    }
  }

  /**
   * 创建预定义的权限组
   */
  private async createPredefinedGroups(): Promise<void> {
    for (const [groupName, permissions] of this.predefinedRoles.entries()) {
      this.logger.log(`创建权限组: ${groupName}`);

      try {
        // 检查权限组是否已存在
        const existingGroup = await this.db
          .select()
          .from(permissionGroups)
          .where(eq(permissionGroups.name, groupName))
          .limit(1);

        if (existingGroup.length === 0) {
          // 创建新的权限组
          await this.createPermissionGroup({
            name: groupName,
            description: `${groupName} 角色的默认权限组`,
            permissions: JSON.stringify(permissions),
          });
          this.logger.log(`权限组 ${groupName} 创建成功`);
        } else {
          // 更新现有权限组的权限
          await this.updatePermissionGroup(existingGroup[0].id, {
            permissions: JSON.stringify(permissions),
          });
          this.logger.log(`权限组 ${groupName} 权限更新成功`);
        }
      } catch (error) {
        this.logger.error(`创建/更新权限组 ${groupName} 失败:`, error);
      }
    }
  }
}
