import { Injectable, NotFoundException, Logger, Inject } from '@nestjs/common';
import { eq, desc, and } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../../database/database.module';
import type { Database } from '../../database/connection';
import { permissionNodes, permissionGroups } from '../../database/schema';
import {
  CreatePermissionNodeType,
  UpdatePermissionNodeType,
  PermissionNodeQueryType,
  PermissionNodeType,
} from './dto/permission-node.dto';
import {
  CreatePermissionGroupType,
  UpdatePermissionGroupType,
  PermissionGroupQueryType,
  PermissionGroupType,
} from './dto/permission-group.dto';
import {
  LimitPermission,
  PERMISSION_MODULES,
  PERMISSION_GROUPS,
} from '../../shared/types/permission';

@Injectable()
export class PermissionService {
  private readonly logger = new Logger(PermissionService.name);
  private readonly registeredPermissions = new Map<string, PermissionNodeType>();

  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  /**
   * 注册权限节点
   * @param permission 权限节点信息
   */
  async registerPermission(
    permission: Omit<CreatePermissionNodeType, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<void> {
    // 检查是否已存在
    const existing = await this.db
      .select()
      .from(permissionNodes)
      .where(eq(permissionNodes.name, permission.name))
      .limit(1);

    if (existing.length === 0) {
      await this.db.insert(permissionNodes).values(permission);
    }

    // 缓存到内存
    this.registeredPermissions.set(permission.name, {
      ...permission,
      description: permission.description ?? null,
      isActive: permission.isActive ?? true,
      id: existing[0]?.id ?? 0,
      createdAt: existing[0]?.createdAt ?? new Date(),
      updatedAt: existing[0]?.updatedAt ?? new Date(),
    });
  }

  /**
   * 解析用户权限，处理禁用权限和权限组
   */
  async resolveUserPermissions(userPermissions: string[]): Promise<string[]> {
    const resolvedPermissions = new Set<string>();
    const disabledPermissions = new Set<string>();

    for (const permission of userPermissions) {
      if (permission.startsWith('no:')) {
        // 禁用权限
        const disabledPermission = permission.slice(3);
        disabledPermissions.add(disabledPermission);

        // 如果是禁用权限组，需要禁用组内所有权限
        if (disabledPermission.startsWith('group:')) {
          const groupName = disabledPermission.slice(6);
          const groupPermissions = await this.getGroupPermissions(groupName);
          groupPermissions.forEach((p) => disabledPermissions.add(p));
        }
      } else if (permission.startsWith('group:')) {
        // 权限组
        const groupName = permission.slice(6);
        const groupPermissions = await this.getGroupPermissions(groupName);
        groupPermissions.forEach((p) => resolvedPermissions.add(p));
      } else {
        // 普通权限
        resolvedPermissions.add(permission);
      }
    }

    // 移除被禁用的权限
    disabledPermissions.forEach((p) => resolvedPermissions.delete(p));

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
    return result;
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
      return await this.db
        .select()
        .from(permissionNodes)
        .orderBy(desc(permissionNodes.createdAt))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit);
    }

    if (conditions.length === 1) {
      return await this.db
        .select()
        .from(permissionNodes)
        .where(conditions[0])
        .orderBy(desc(permissionNodes.createdAt))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit);
    }

    return await this.db
      .select()
      .from(permissionNodes)
      .where(and(...conditions))
      .orderBy(desc(permissionNodes.createdAt))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);
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

    return result[0];
  }

  async updatePermissionNode(
    id: number,
    updatePermissionNodeDto: UpdatePermissionNodeType,
  ): Promise<PermissionNodeType> {
    const result = await this.db
      .update(permissionNodes)
      .set({ ...updatePermissionNodeDto, updatedAt: new Date() })
      .where(eq(permissionNodes.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Permission node with ID ${String(id)} not found`);
    }

    return result[0];
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
    };
  }

  async updatePermissionGroup(
    id: number,
    updatePermissionGroupDto: UpdatePermissionGroupType,
  ): Promise<PermissionGroupType> {
    const result = await this.db
      .update(permissionGroups)
      .set({ ...updatePermissionGroupDto, updatedAt: new Date() })
      .where(eq(permissionGroups.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Permission group with ID ${String(id)} not found`);
    }

    return {
      ...result[0],
      permissions: result[0].permissions ? (JSON.parse(result[0].permissions) as string[]) : null,
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
      await this.registerModulePermissions();

      // 2. 创建预定义的权限组
      await this.createPredefinedGroups();

      this.logger.log('权限系统初始化完成');
    } catch (error) {
      this.logger.error('权限系统初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取权限组的权限列表
   * @param groupName 权限组名称
   * @returns 权限列表
   */
  private async getGroupPermissions(groupName: string): Promise<LimitPermission[]> {
    const group = await this.db
      .select()
      .from(permissionGroups)
      .where(eq(permissionGroups.name, groupName))
      .limit(1);

    if (group.length === 0) {
      return [];
    }

    try {
      return group[0].permissions ? (JSON.parse(group[0].permissions) as LimitPermission[]) : [];
    } catch {
      return [];
    }
  }

  /**
   * 注册所有模块的权限节点
   */
  private async registerModulePermissions(): Promise<void> {
    for (const [moduleName, permissions] of Object.entries(PERMISSION_MODULES)) {
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
    for (const [groupName, permissions] of Object.entries(PERMISSION_GROUPS)) {
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
