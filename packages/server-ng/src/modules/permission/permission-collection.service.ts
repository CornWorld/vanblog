import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  Optional,
  forwardRef,
} from '@nestjs/common';

// 从 permission.module.ts 导入令牌
import { PERMISSIONS } from './permission.module';
import { PermissionService } from './permission.service';

// 全局贡献寄存器，避免在模块装配阶段直接依赖服务实例
const GLOBAL_PERMISSION_CONTRIBUTIONS = new Set<string>();
export function contributePermissions(perms: string[]): void {
  for (const p of perms) GLOBAL_PERMISSION_CONTRIBUTIONS.add(p);
}
export function getContributedPermissions(): string[] {
  return Array.from(GLOBAL_PERMISSION_CONTRIBUTIONS);
}
export function clearContributedPermissions(): void {
  GLOBAL_PERMISSION_CONTRIBUTIONS.clear();
}

@Injectable()
export class PermissionCollectionService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PermissionCollectionService.name);
  private readonly allRegisteredPermissions = new Set<string>();

  // 使用 @Optional() 避免在没有任何模块注册权限时出错
  // 注意：NestJS 不支持 Angular 风格的 multi provider，这里的注入仅代表当前模块提供的权限数组
  constructor(
    @Optional()
    @Inject(PERMISSIONS)
    private readonly permissionSets: string[] = [], // 默认为空数组
    @Inject(forwardRef(() => PermissionService))
    private readonly permissionService: PermissionService,
  ) {
    this.logger.log('PermissionCollectionService constructor called');
    // 调试：检查构造时的权限收集情况
    this.logger.debug('Constructor - Received permissions', {
      count: this.permissionSets.length,
      permissions: this.permissionSets,
      isArray: Array.isArray(this.permissionSets),
    });
  }

  /**
   * 在模块装配阶段由 forFeature 工厂主动贡献权限。
   * 该方法是幂等的，多次调用不会产生重复项。
   */
  addPermissions(permissions: string[]): void {
    for (const p of permissions) {
      this.allRegisteredPermissions.add(p);
    }
    this.logger.debug('Contributed permissions', {
      contributed: permissions,
      total: this.allRegisteredPermissions.size,
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    this.logger.debug('Bootstrap - Processing permissions', {
      injectedCount: this.permissionSets.length,
    });

    // 合并来自工厂阶段的全局贡献
    const contributed = getContributedPermissions();
    for (const p of contributed) {
      this.allRegisteredPermissions.add(p);
    }
    // 消费后清空，避免多次启动或测试之间的污染
    clearContributedPermissions();

    // 合并注入的权限集合（不要覆盖之前通过 addPermissions 贡献的集合）
    for (const p of this.permissionSets) {
      this.allRegisteredPermissions.add(p);
    }

    // 完成注册
    this.registerModulePermissions();

    this.logger.debug('After registration', {
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
   * 注意：仅提供 admin 与 viewer 的默认行为；其他角色来自数据库的用户权限与覆盖机制。
   */
  private getDefaultRolesForModule(
    _module: string,
    permissions: string[],
  ): Record<string, string[]> {
    const roles: Record<string, string[]> = {};

    // 管理员拥有所有权限
    roles.admin = [...permissions];

    // 访客只有读权限
    if (permissions.includes('read')) {
      roles.viewer = ['read'];
    }

    // 其他角色（editor/author/…）由 PermissionService 的用户权限解析与覆盖机制产生
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
