import { beforeEach, describe, expect, it } from 'vitest';

import { PermissionService } from '../src/modules/permission/permission.service';

import { createTestApp } from './test-utils';

import type { INestApplication } from '@nestjs/common';

describe('Anonymous Permission Chain (e2e)', () => {
  let app: INestApplication;
  let permissionService: PermissionService;

  beforeEach(async () => {
    app = await createTestApp();
    permissionService = app.get<PermissionService>(PermissionService);

    // 给权限系统一些时间完成初始化
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  it('should validate anonymous permission chain', async () => {
    // Step 1: 模拟 JWT 策略返回的匿名用户权限
    const anonymousUserPermissions = ['role:viewer'];

    // Step 2: 验证权限解析
    const resolvedPermissions =
      await permissionService.resolveUserPermissions(anonymousUserPermissions);

    console.log('匿名用户原始权限:', anonymousUserPermissions);
    console.log('解析后权限:', resolvedPermissions);

    // Step 3: 检查是否包含 sitemap:read
    const hasSitemapRead = resolvedPermissions.includes('sitemap:read');
    console.log('包含 sitemap:read:', hasSitemapRead);

    // Step 4: 通过 hasPermissions 验证
    const hasPermissionResult = await permissionService.hasPermissions(anonymousUserPermissions, [
      'sitemap:read',
    ]);

    console.log('hasPermissions 结果:', hasPermissionResult);

    expect(hasPermissionResult).toBe(true);
  });
});
