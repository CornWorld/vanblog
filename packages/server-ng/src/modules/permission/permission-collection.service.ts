import { Inject, Injectable, OnModuleInit, Optional } from '@nestjs/common';

// 从 permission.module.ts 导入令牌
import { PERMISSIONS } from './permission.module';
import { PermissionService } from './permission.service';

@Injectable()
export class PermissionCollectionService implements OnModuleInit {
  private allRegisteredPermissions = new Set<string>();

  // 使用 @Optional() 避免在没有任何模块注册权限时出错
  // 由于 multi: true，permissionSets 会直接是一个一维数组 [p1, p2, p3, ...]
  constructor(
    @Optional()
    @Inject(PERMISSIONS)
    private readonly permissionSets: string[] = [], // 默认为空数组
    private readonly permissionService: PermissionService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.allRegisteredPermissions = new Set(this.permissionSets);
    this.registerModulePermissions();

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
    for (const permission of this.permissionSets) {
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
