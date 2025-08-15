import { Inject, Injectable, OnModuleInit, Optional } from '@nestjs/common';

// 从 permission.module.ts 导入令牌
import { PERMISSIONS } from './permission.module';

@Injectable()
export class PermissionCollectionService implements OnModuleInit {
  private allRegisteredPermissions = new Set<string>();

  // 使用 @Optional() 避免在没有任何模块注册权限时出错
  // 由于 multi: true，permissionSets 会直接是一个一维数组 [p1, p2, p3, ...]
  constructor(
    @Optional()
    @Inject(PERMISSIONS)
    private readonly permissionSets: string[] = [], // 默认为空数组
  ) {}

  onModuleInit(): void {
    this.allRegisteredPermissions = new Set(this.permissionSets);
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
