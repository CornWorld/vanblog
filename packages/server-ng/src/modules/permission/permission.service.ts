import { Injectable, NotFoundException, Logger, Inject } from '@nestjs/common';
import { dayjs } from '@vanblog/shared';
import { permissionNodes, permissionGroups } from '@vanblog/shared/drizzle';
import { eq, desc, and } from 'drizzle-orm';

import { DATABASE_CONNECTION, type Database } from '../../database';

import {
  CreatePermissionGroupType,
  UpdatePermissionGroupType,
  PermissionGroupQueryType,
  PermissionGroupType,
  PermissionGroupSchema,
} from './dto/permission-group.dto';
import {
  CreatePermissionNodeType,
  UpdatePermissionNodeType,
  PermissionNodeQueryType,
  PermissionNodeType,
} from './dto/permission-node.dto';

import type { Dayjs } from 'dayjs';

export interface PermissionRegistration {
  module: string;
  permissions?: string[];
  roles?: Record<string, string[]>;
}

export interface ModulePermissionInfo {
  fullPermissions: string[];
  semanticPermissions: string[];
}

// 强类型：权限组表的选择行类型
type PermissionGroupSelect = typeof permissionGroups.$inferSelect;

@Injectable()
export class PermissionService {
  private readonly logger = new Logger(PermissionService.name);
  private readonly registeredPermissions = new Map<string, PermissionNodeType>();
  private readonly modulePermissions = new Map<string, string[]>();
  private readonly predefinedRoles = new Map<string, string[]>();
  private readonly moduleContext = new Map<string, string[]>();
  // 缓存：已知权限集合（当 register 调整模块权限后失效）
  private cachedKnownPermissions: Set<string> | null = null;
  // 缓存：角色展开后的权限列表（当权限组或注册的预定义角色发生变化时失效）
  private readonly rolePermissionsCache = new Map<string, string[]>();

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {
    // 每次实例化时都初始化预定义权限组
    this.initializePredefinedGroups();
  }

  /**
   * 初始化预定义角色
   */
  private initializePredefinedGroups(): void {
    // 只在 Map 为空时初始化基础角色，避免重复初始化时清空已注册的权限
    if (this.predefinedRoles.size === 0) {
      // 这些是基础的角色，各模块可以通过 register 方法添加更多
      this.predefinedRoles.set('admin', []);
      this.predefinedRoles.set('editor', []);
      this.predefinedRoles.set('author', []);
      this.predefinedRoles.set('viewer', []);
      this.logger.log('初始化预定义角色完成');
    }
  }

  /**
   * 注册模块权限和角色权限
   * @param config 权限注册配置
   */
  register(config: PermissionRegistration): void {
    const { module, permissions = [], roles = {} } = config;

    this.logger.log(`注册模块 ${module} 的权限: ${permissions.join(', ')}`);

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
      this.logger.log(`为角色 ${roleName} 添加权限: ${fullRolePermissions.join(', ')}`);
    });

    this.logger.log(`模块 ${module} 权限注册完成，完整权限: ${fullPermissions.join(', ')}`);
    this.logger.log(`当前 admin 角色权限: ${JSON.stringify(this.predefinedRoles.get('admin'))}`);

    // 失效缓存：模块权限与预定义角色发生变化
    this.cachedKnownPermissions = null;
    this.rolePermissionsCache.clear();
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
          createdAt:
            typeof existingPermission[0].createdAt === 'string'
              ? existingPermission[0].createdAt
              : dayjs(existingPermission[0].createdAt).format(),
          updatedAt:
            typeof existingPermission[0].updatedAt === 'string'
              ? existingPermission[0].updatedAt
              : dayjs(existingPermission[0].updatedAt).format(),
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
    this.logger.debug(`开始解析用户权限: ${JSON.stringify(userPermissions)}`);
    const resolvedPermissions = new Set<string>();

    for (const token of userPermissions) {
      this.logger.debug(`处理权限 token: ${token}`);

      if (token === 'all') {
        // 特殊权限：all
        this.logger.debug('添加 all 权限');
        resolvedPermissions.add('all');
        continue;
      }

      if (token.startsWith('no:')) {
        // 撤销权限或角色
        const target = token.slice(3);
        this.logger.debug(`撤销权限: ${target}`);
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

    // 过滤未知权限：仅保留 'all' 或已注册的权限节点
    const known = this.getKnownPermissionsSet();
    const filtered = Array.from(resolvedPermissions).filter((p) => {
      if (p === 'all') return true;
      const ok = this.isKnownPermission(p, known);
      if (!ok) this.logger.warn(`未知权限 '${p}' 已被忽略`);
      return ok;
    });

    return filtered;
  }

  /**
   * 计算已知权限集合（来自各模块注册的完整权限名）
   */
  private getKnownPermissionsSet(): Set<string> {
    if (this.cachedKnownPermissions) return this.cachedKnownPermissions;
    const set = new Set<string>();
    for (const perms of this.modulePermissions.values()) {
      for (const p of perms) set.add(p);
    }
    this.cachedKnownPermissions = set;
    return set;
  }

  /**
   * 判断是否为已注册权限
   */
  private isKnownPermission(permission: string, known?: Set<string>): boolean {
    const set = known ?? this.getKnownPermissionsSet();
    // 仅接受完整的 module:action 形式
    if (!permission.includes(':')) return false;
    return set.has(permission);
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
      createdAt:
        typeof result.createdAt === 'string' ? result.createdAt : dayjs(result.createdAt).format(),
      updatedAt:
        typeof result.updatedAt === 'string' ? result.updatedAt : dayjs(result.updatedAt).format(),
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
        createdAt:
          typeof node.createdAt === 'string' ? node.createdAt : dayjs(node.createdAt).format(),
        updatedAt:
          typeof node.updatedAt === 'string' ? node.updatedAt : dayjs(node.updatedAt).format(),
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
        createdAt:
          typeof node.createdAt === 'string' ? node.createdAt : dayjs(node.createdAt).format(),
        updatedAt:
          typeof node.updatedAt === 'string' ? node.updatedAt : dayjs(node.updatedAt).format(),
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
      createdAt:
        typeof node.createdAt === 'string' ? node.createdAt : dayjs(node.createdAt).format(),
      updatedAt:
        typeof node.updatedAt === 'string' ? node.updatedAt : dayjs(node.updatedAt).format(),
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
      createdAt:
        typeof result[0].createdAt === 'string'
          ? result[0].createdAt
          : dayjs(result[0].createdAt).format(),
      updatedAt:
        typeof result[0].updatedAt === 'string'
          ? result[0].updatedAt
          : dayjs(result[0].updatedAt).format(),
    };
  }

  async updatePermissionNode(
    id: number,
    updatePermissionNodeDto: UpdatePermissionNodeType,
  ): Promise<PermissionNodeType> {
    const result = await this.db
      .update(permissionNodes)
      .set({ ...updatePermissionNodeDto, updatedAt: dayjs().format() })
      .where(eq(permissionNodes.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Permission node with ID ${String(id)} not found`);
    }

    return {
      ...result[0],
      createdAt:
        typeof result[0].createdAt === 'string'
          ? result[0].createdAt
          : dayjs(result[0].createdAt).format(),
      updatedAt:
        typeof result[0].updatedAt === 'string'
          ? result[0].updatedAt
          : dayjs(result[0].updatedAt).format(),
    };
  }

  async removePermissionNode(id: number): Promise<void> {
    const result = await this.db.delete(permissionNodes).where(eq(permissionNodes.id, id));

    if (result.rowsAffected === 0) {
      throw new NotFoundException(`Permission node with ID ${String(id)} not found`);
    }
  }

  // 将原始权限组行的 createdAt/updatedAt 统一规范为 ISO 字符串，便于 Zod 解析
  private normalizePermissionGroupRow<
    T extends {
      createdAt: string | number | Date | Dayjs | null | undefined;
      updatedAt: string | number | Date | Dayjs | null | undefined;
    },
  >(row: T): Omit<T, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string } {
    const toIso = (v: string | number | Date | Dayjs | null | undefined): string => {
      if (typeof v === 'string') return v;
      const d = dayjs(v ?? undefined);
      return d.format();
    };

    return {
      ...row,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    } as Omit<T, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string };
  }

  // CRUD 操作 - 权限组
  async createPermissionGroup(
    createPermissionGroupDto: CreatePermissionGroupType,
  ): Promise<PermissionGroupType> {
    const [result] = await this.db
      .insert(permissionGroups)
      .values({
        ...createPermissionGroupDto,
        permissions: createPermissionGroupDto.permissions,
      })
      .returning();
    // 影响角色权限：失效缓存
    this.rolePermissionsCache.clear();
    return PermissionGroupSchema.parse(this.normalizePermissionGroupRow(result));
  }

  async findAllPermissionGroups(query: PermissionGroupQueryType): Promise<PermissionGroupType[]> {
    let results: PermissionGroupSelect[];

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

    return results.map((group) =>
      PermissionGroupSchema.parse(this.normalizePermissionGroupRow(group)),
    );
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

    return PermissionGroupSchema.parse(
      this.normalizePermissionGroupRow(result[0] as PermissionGroupSelect),
    );
  }

  async updatePermissionGroup(
    id: number,
    updatePermissionGroupDto: UpdatePermissionGroupType,
  ): Promise<PermissionGroupType> {
    const updates: {
      name?: string;
      description?: string | null;
      permissions?: string[] | null;
      isActive?: boolean | null;
      updatedAt: string;
    } = {
      ...updatePermissionGroupDto,
      permissions: updatePermissionGroupDto.permissions,
      updatedAt: dayjs().format(),
    };

    const result = await this.db
      .update(permissionGroups)
      .set(updates)
      .where(eq(permissionGroups.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Permission group with ID ${String(id)} not found`);
    }

    // 影响角色权限：失效缓存
    this.rolePermissionsCache.clear();
    return PermissionGroupSchema.parse(this.normalizePermissionGroupRow(result[0]));
  }

  async removePermissionGroup(id: number): Promise<void> {
    const result = await this.db.delete(permissionGroups).where(eq(permissionGroups.id, id));

    if (result.rowsAffected === 0) {
      throw new NotFoundException(`Permission group with ID ${String(id)} not found`);
    }

    // 影响角色权限：失效缓存
    this.rolePermissionsCache.clear();
  }

  async initializePermissions(): Promise<void> {
    // 注册所有模块权限
    await this.registerAllModulePermissions();

    this.logger.log(
      'Before createPredefinedGroups - predefinedRoles size:',
      this.predefinedRoles.size,
    );
    // 创建预定义权限组
    await this.ensurePredefinedGroups();

    // 初始化完成后，已知权限集合与角色权限可能已变化：失效相关缓存
    this.cachedKnownPermissions = null;
    this.rolePermissionsCache.clear();
  }

  private async getRolePermissions(roleName: string): Promise<string[]> {
    // 命中缓存直接返回
    const cached = this.rolePermissionsCache.get(roleName);
    if (cached) return cached;

    const group = await this.db
      .select()
      .from(permissionGroups)
      .where(eq(permissionGroups.name, roleName))
      .limit(1);

    if (group.length === 0) {
      // Fallback to predefined roles collected during module registration
      const predefined = this.predefinedRoles.get(roleName) ?? [];
      const known = this.getKnownPermissionsSet();
      const filtered = predefined.filter((p) => this.isKnownPermission(p, known));
      this.rolePermissionsCache.set(roleName, filtered);
      return filtered;
    }

    const dbPermissions =
      PermissionGroupSchema.parse(
        this.normalizePermissionGroupRow(group[0] as PermissionGroupSelect),
      ).permissions ?? [];

    // 过滤非法/未注册权限
    const known = this.getKnownPermissionsSet();
    const filtered = dbPermissions.filter((p) => this.isKnownPermission(p, known));
    this.rolePermissionsCache.set(roleName, filtered);
    return filtered;
  }

  private async registerAllModulePermissions(): Promise<void> {
    for (const [module, permissions] of this.modulePermissions) {
      for (const perm of permissions) {
        // perm 这里已经是 `${module}:action` 完整格式
        await this.registerPermission({
          module,
          name: perm,
          description: `${module} 模块的 ${perm.split(':')[1]} 权限`,
        });
      }
    }
  }

  private async ensurePredefinedGroups(): Promise<void> {
    this.logger.log(`开始确保预定义权限组，当前角色数量: ${String(this.predefinedRoles.size)}`);

    for (const [roleName, permissions] of this.predefinedRoles) {
      this.logger.log(`处理角色 ${roleName}，权限: ${JSON.stringify(permissions)}`);

      // 检查权限组是否已存在
      const existingGroup = await this.db
        .select()
        .from(permissionGroups)
        .where(eq(permissionGroups.name, roleName))
        .limit(1);

      if (existingGroup.length === 0) {
        // 创建新的权限组
        this.logger.log(`创建新权限组: ${roleName}`);
        await this.db.insert(permissionGroups).values({
          name: roleName,
          description: `预定义角色: ${roleName}`,
          permissions,
          isActive: true,
        });
      } else {
        // 更新现有权限组的权限列表
        // 只有当内存中的权限非空时才更新，避免用空数组覆盖已有权限
        if (permissions.length > 0) {
          this.logger.log(`更新现有权限组: ${roleName}`);
          await this.db
            .update(permissionGroups)
            .set({ permissions })
            .where(eq(permissionGroups.name, roleName));
        } else {
          this.logger.log(`跳过更新权限组 ${roleName}（内存中权限为空，保留数据库中的值）`);
        }
      }
    }

    this.logger.log('预定义权限组确保完成');
  }
}
