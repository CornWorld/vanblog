import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { PermissionCollectionService } from '../src/modules/permission/permission-collection.service';
import { PermissionService } from '../src/modules/permission/permission.service';

import type { INestApplication } from '@nestjs/common';

describe('Debug Permissions Initialization', () => {
  let app: INestApplication;
  let permissionService: PermissionService;
  let collectionService: PermissionCollectionService;

  beforeAll(async () => {
    const appModule = await AppModule.forRoot();
    const moduleFixture = await Test.createTestingModule({
      imports: [appModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    permissionService = moduleFixture.get(PermissionService);
    collectionService = moduleFixture.get(PermissionCollectionService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should have viewer role with sitemap:read permissions', async () => {
    // 等待权限系统完全初始化
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 1. 检查已注册的权限
    const registeredPermissions = collectionService.getRegisteredPermissions();

    // 2. 检查 sitemap 模块权限
    const sitemapPermissions = permissionService.getModulePermissions('sitemap');

    // 3. 模拟匿名用户权限解析
    const anonymousPermissions = await permissionService.resolveUserPermissions(['role:viewer']);

    // 4. 检查权限验证
    const hasSitemapRead = await permissionService.hasPermissions(anonymousPermissions, [
      'sitemap:read',
    ]);

    // 验证期望
    expect(registeredPermissions).toContain('sitemap:read');
    expect(sitemapPermissions).toContain('sitemap:read');
    expect(anonymousPermissions).toContain('sitemap:read');
    expect(hasSitemapRead).toBe(true);
  });
});
