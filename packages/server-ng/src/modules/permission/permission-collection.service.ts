import { Inject, Injectable, OnApplicationBootstrap, Optional } from '@nestjs/common';

// 从 permission.module.ts 导入令牌
import { PERMISSIONS } from './permission.module';
import { PermissionService } from './permission.service';

@Injectable()
export class PermissionCollectionService implements OnApplicationBootstrap {
  private allRegisteredPermissions = new Set<string>();
  private readonly collectedPermissions = new Set<string>();

  // 使用 @Optional() 避免在没有任何模块注册权限时出错
  // 由于 multi: true，permissionSets 会直接是一个一维数组 [p1, p2, p3, ...]
  constructor(
    @Optional()
    @Inject(PERMISSIONS)
    private readonly permissionSets: string[] = [], // 默认为空数组
    private readonly permissionService: PermissionService,
  ) {
    // 调试：检查构造时的权限收集情况
    console.log('[PermissionCollectionService] Constructor - Received permissions:', {
      count: this.permissionSets.length,
      permissions: this.permissionSets,
      isArray: Array.isArray(this.permissionSets),
    });
  }

  /**
   * 供各业务模块在 forFeature 阶段调用，用于贡献自身的权限集合。
   */
  contributePermissions(permissions: string[]): void {
    for (const p of permissions) this.collectedPermissions.add(p);
    console.log('[PermissionCollectionService] Contributed permissions:', permissions);
  }

  async onApplicationBootstrap(): Promise<void> {
    console.log('[PermissionCollectionService] Bootstrap - Processing permissions:', {
      injectedCount: this.permissionSets.length,
      collectedCount: this.collectedPermissions.size,
    });

    // 优先采用运行期收集到的权限，其次回退到注入的权限（兼容旧实现）
    const finalPermissions =
      this.collectedPermissions.size > 0
        ? Array.from(this.collectedPermissions)
        : this.permissionSets;

    // 保存全集
    this.allRegisteredPermissions = new Set(finalPermissions);

    // 完成注册
    this.registerModulePermissions();

    console.log('[PermissionCollectionService] After registration:', {
      registeredCount: this.allRegisteredPermissions.size,
      registered: Array.from(this.allRegisteredPermissions),
    });

    // 初始化权限节点与预定义权限组（幂等）
    await this.permissionService.initializePermissions();
  }

  /**
   * 自动注册模块权限
   * 从收集到的权限中推导模块名和权限列表，自动调用 PermissionService.register
   */
  private registerModulePermissions(): void {
    const modulePermissions = new Map<string, string[]>();

    // 分析权限列表，按模块分组
    for (const permission of this.allRegisteredPermissions) {
      if (permission.includes(':')) {
        const [module, perm] = permission.split(':', 2);
        const list = modulePermissions.get(module) ?? [];
        list.push(perm);
        modulePermissions.set(module, list);
      }
    }

    // 为每个模块调用 register 方法
    for (const [module, permissions] of modulePermissions.entries()) {
      this.permissionService.register({
        module,
        permissions,
        roles: this.getDefaultRolesForModule(module, permissions),
      });
    }
  }

  /**
   * 为模块生成默认的角色权限映射
   */
  private getDefaultRolesForModule(
    _module: string,
    permissions: string[],
  ): Record<string, string[]> {
    const roles: Record<string, string[]> = {};

    // 管理员拥有所有权限
    roles.admin = [...permissions];

    // 编辑者通常有读写权限，但不能删除
    const editorPermissions = permissions.filter((p) => !p.includes('delete'));
    if (editorPermissions.length > 0) {
      roles.editor = editorPermissions;
    }

    // 作者通常有读权限和部分写权限
    const authorPermissions = permissions.filter(
      (p) => p === 'read' || p === 'create' || p === 'update',
    );
    if (authorPermissions.length > 0) {
      roles.author = authorPermissions;
    }

    // 访客只有读权限
    if (permissions.includes('read')) {
      roles.viewer = ['read'];
    }

    return roles;
  }

  getRegisteredPermissions(): string[] {
    return Array.from(this.allRegisteredPermissions);
  }

  /**
   * 检查权限是否已注册
   */
  hasPermission(permission: string): boolean {
    return this.allRegisteredPermissions.has(permission);
  }

  /**
   * 获取权限总数
   */
  getPermissionCount(): number {
    return this.allRegisteredPermissions.size;
  }
}
