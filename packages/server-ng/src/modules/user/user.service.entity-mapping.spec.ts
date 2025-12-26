/**
 * @fileoverview UserService 实体映射测试
 *
 * 测试场景：
 * - mapToEntity 方法（数据库实体 → API 响应）
 * - 敏感字段过滤（password 默认排除，可选包含）
 * - 字段转换逻辑（null → undefined，空数组 → undefined）
 * - 可选字段处理（email, nickname, avatar, permissions）
 *
 * 关联文件：
 * - user.service.spec.ts - 核心 CRUD 操作
 * - user.service.create-advanced.spec.ts - 高级创建场景
 * - user.service.update-password.spec.ts - 密码处理
 * - user.service.permissions.spec.ts - 权限管理
 */

import { Test, type TestingModule } from '@nestjs/testing';
// import { users } from '@vanblog/shared/drizzle';
import { vi } from 'vitest';

import { MockUtils } from '../../../test/mock-utils';
import { DATABASE_CONNECTION } from '../../database';
import { HookService } from '../plugin/services/hook.service';

import { UserService } from './user.service';

vi.mock('bcrypt');

describe('UserService - Entity Mapping', () => {
  let service: UserService;
  let databaseMock: InstanceType<typeof MockUtils.database>;
  let mockHookService: Partial<HookService>;

  beforeEach(async () => {
    // 使用Mock工具类创建数据库Mock
    databaseMock = new MockUtils.database();

    // 创建Hook服务Mock
    mockHookService = {
      applyFilters: vi.fn().mockImplementation((_, data) => data),
      doAction: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: DATABASE_CONNECTION,
          useValue: databaseMock.db,
        },
        {
          provide: HookService,
          useValue: mockHookService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterEach(() => {
    vi.clearAllMocks();
    databaseMock.reset();
  });

  describe('Password Field Handling', () => {
    it('should exclude password by default', async () => {
      const dbUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        nickname: 'Test User',
        avatar: null,
        type: 'admin',
        permissions: ['all'],
        password: 'hashedPassword123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      databaseMock.setQueryResult([dbUser]);

      const result = await service.findOne(1);

      expect(result.password).toBeUndefined();
    });

    it('should include password when explicitly requested', async () => {
      const dbUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        nickname: 'Test User',
        avatar: null,
        type: 'admin',
        permissions: ['all'],
        password: 'hashedPassword123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      databaseMock.setQueryResult([dbUser]);

      const result = await service.findByUsernameWithPassword('testuser');

      expect(result?.password).toBe('hashedPassword123');
    });
  });

  describe('Permissions Field Conversion', () => {
    it('should convert null permissions to undefined', async () => {
      const dbUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        nickname: 'Test User',
        avatar: null,
        type: 'admin',
        permissions: null,
        password: 'hashedPassword123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      databaseMock.setQueryResult([dbUser]);

      const result = await service.findOne(1);

      expect(result.permissions).toBeUndefined();
    });

    it('should convert empty permissions array to undefined', async () => {
      const dbUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        nickname: 'Test User',
        avatar: null,
        type: 'admin',
        permissions: [],
        password: 'hashedPassword123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      databaseMock.setQueryResult([dbUser]);

      const result = await service.findOne(1);

      expect(result.permissions).toBeUndefined();
    });

    it('should preserve non-empty permissions array', async () => {
      const dbUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        nickname: 'Test User',
        avatar: null,
        type: 'admin',
        permissions: ['read', 'write'],
        password: 'hashedPassword123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      databaseMock.setQueryResult([dbUser]);

      const result = await service.findOne(1);

      expect(result.permissions).toEqual(['read', 'write']);
    });
  });

  describe('Optional Fields Conversion', () => {
    it('should convert null optional fields to undefined', async () => {
      const dbUser = {
        id: 1,
        username: 'testuser',
        email: null,
        nickname: null,
        avatar: null,
        type: 'admin',
        permissions: null,
        password: 'hashedPassword123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      databaseMock.setQueryResult([dbUser]);

      const result = await service.findOne(1);

      expect(result.email).toBeUndefined();
      expect(result.nickname).toBeUndefined();
      expect(result.avatar).toBeUndefined();
      expect(result.permissions).toBeUndefined();
    });
  });
});
