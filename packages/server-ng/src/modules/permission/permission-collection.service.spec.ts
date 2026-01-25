import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import {
  PermissionCollectionService,
  contributePermissions,
  clearContributedPermissions,
  getContributedPermissions,
} from './permission-collection.service';
import { PERMISSIONS } from './permission.module';
import { PermissionService } from './permission.service';

describe('PermissionCollectionService', () => {
  let service: PermissionCollectionService;
  let permissionServiceMock: {
    register: ReturnType<typeof vi.fn>;
    initializePermissions: ReturnType<typeof vi.fn>;
  };

  async function createModule(injectedPermissions: string[] = []): Promise<void> {
    permissionServiceMock = {
      register: vi.fn(),
      initializePermissions: vi.fn().mockResolvedValue(undefined),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionCollectionService,
        { provide: PermissionService, useValue: permissionServiceMock },
        { provide: PERMISSIONS, useValue: injectedPermissions },
      ],
    }).compile();

    service = moduleRef.get<PermissionCollectionService>(PermissionCollectionService);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    clearContributedPermissions();
  });

  afterEach(() => {
    vi.clearAllMocks();
    clearContributedPermissions();
  });

  it('addPermissions 应该去重并累计到集合中', async () => {
    await createModule();

    service.addPermissions(['article:read', 'article:write', 'article:read']);

    expect(service.getPermissionCount()).toBe(2);
    expect(service.hasPermission('article:read')).toBe(true);
    expect(service.hasPermission('article:write')).toBe(true);
    expect(service.hasPermission('article:delete')).toBe(false);
  });

  it('onApplicationBootstrap 应该合并贡献/注入/手动添加的权限并按模块注册，最后初始化权限系统', async () => {
    // 贡献权限（模拟 forFeature 的工厂阶段）
    contributePermissions(['article:read']);

    // 注入权限（模拟某 FeatureModule 提供的权限数组）
    await createModule(['comment:read']);

    // 手动添加（模拟运行时收集）
    service.addPermissions(['article:write', 'comment:moderate']);

    await service.onApplicationBootstrap();

    // register 应该针对每个模块调用一次
    expect(permissionServiceMock.register).toHaveBeenCalledTimes(2);

    // 校验 article 模块注册
    expect(permissionServiceMock.register).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'article',
        permissions: expect.arrayContaining(['read', 'write']),
        roles: expect.objectContaining({
          admin: expect.arrayContaining(['read', 'write']),
          viewer: expect.arrayContaining(['read']),
        }),
      }),
    );

    // 校验 comment 模块注册
    expect(permissionServiceMock.register).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'comment',
        permissions: expect.arrayContaining(['read', 'moderate']),
        roles: expect.objectContaining({
          admin: expect.arrayContaining(['read', 'moderate']),
          viewer: expect.arrayContaining(['read']),
        }),
      }),
    );

    // initializePermissions 必须被调用
    expect(permissionServiceMock.initializePermissions).toHaveBeenCalledTimes(1);

    // 全局贡献在消费后应被清空，避免跨测试污染
    expect(getContributedPermissions()).toEqual([]);

    // 服务内部集合应包含所有完整权限
    const regs = service.getRegisteredPermissions();
    expect(regs).toEqual(
      expect.arrayContaining(['article:read', 'article:write', 'comment:read', 'comment:moderate']),
    );
    expect(service.getPermissionCount()).toBe(4);
    expect(service.hasPermission('article:read')).toBe(true);
    expect(service.hasPermission('unknown:xx')).toBe(false);
  });

  it('应忽略不符合 "module:perm" 格式的字符串，不触发注册', async () => {
    contributePermissions(['invalid-format', 'user:create']);

    await createModule();

    await service.onApplicationBootstrap();

    // 只应为 user 模块注册一次
    expect(permissionServiceMock.register).toHaveBeenCalledTimes(1);
    expect(permissionServiceMock.register).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'user',
        permissions: expect.arrayContaining(['create']),
      }),
    );
  });

  it('当没有任何权限时，仍应调用 initializePermissions，但不调用 register', async () => {
    await createModule();

    await service.onApplicationBootstrap();

    expect(permissionServiceMock.register).not.toHaveBeenCalled();
    expect(permissionServiceMock.initializePermissions).toHaveBeenCalledTimes(1);
  });
});
