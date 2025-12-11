import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { users } from '@vanblog/shared/drizzle';
import * as bcrypt from 'bcrypt';
import { vi } from 'vitest';

import { MockUtils } from '../../../test/mock-utils';
import { DATABASE_CONNECTION } from '../../database';
import { HookService } from '../plugin/services/hook.service';

import { UserService } from './user.service';

import type { CreateUserDto } from './dto/create-user.dto';

vi.mock('bcrypt');
const mockedBcrypt = vi.mocked(bcrypt);

describe('UserService', () => {
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

  describe('create', () => {
    it('should create a new user successfully', async () => {
      const createUserDto: CreateUserDto = {
        username: 'testuser',
        password: 'password123',
        nickname: 'Test User',
        email: 'test@example.com',
        type: 'admin',
        permissions: 'read,write',
      };

      const hashedPassword = 'hashedPassword123';
      mockedBcrypt.hash.mockResolvedValue(hashedPassword as never);

      const createdDbUser = {
        id: 1,
        username: createUserDto.username,
        password: hashedPassword,
        nickname: createUserDto.nickname,
        email: createUserDto.email,
        type: createUserDto.type,
        permissions: ['read', 'write'], // Drizzle with mode: 'json' returns native arrays
        avatar: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // First query checks if username exists (should return empty)
      databaseMock.setQueryResult([]);
      // Then insert the new user
      databaseMock.setInsertResult([createdDbUser]);

      const result = await service.create(createUserDto);

      expect(result).toMatchObject({
        id: 1,
        username: 'testuser',
        nickname: 'Test User',
        email: 'test@example.com',
        type: 'admin',
        permissions: ['read', 'write'],
      });
      expect(result.password).toBeUndefined(); // password should not be included
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(databaseMock.db.insert).toHaveBeenCalledWith(users);
    });

    it('should throw ConflictException if username already exists', async () => {
      const createUserDto: CreateUserDto = {
        username: 'existinguser',
        password: 'password123',
        nickname: 'Test User',
        email: 'test@example.com',
        type: 'admin',
        permissions: 'read',
      };

      // Mock existing user found
      databaseMock.setQueryResult([{ id: 1, username: 'existinguser' }]);

      await expect(service.create(createUserDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      const dbUsers = [
        {
          id: 1,
          username: 'user1',
          email: 'user1@example.com',
          nickname: 'User 1',
          avatar: null,
          type: 'admin',
          permissions: [], // Drizzle with mode: 'json' returns native arrays
          password: 'hashedpassword1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          username: 'user2',
          email: 'user2@example.com',
          nickname: 'User 2',
          avatar: null,
          type: 'collaborator',
          permissions: ['read'], // Drizzle with mode: 'json' returns native arrays
          password: 'hashedpassword2',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      databaseMock.setQueryResult(dbUsers);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 1,
        username: 'user1',
        email: 'user1@example.com',
        nickname: 'User 1',
        type: 'admin',
        permissions: undefined, // Empty array is converted to undefined by mapToEntity
      });
      expect(result[0].password).toBeUndefined();
      expect(result[1]).toMatchObject({
        id: 2,
        username: 'user2',
        email: 'user2@example.com',
        nickname: 'User 2',
        type: 'collaborator',
        permissions: ['read'],
      });
      expect(result[1].password).toBeUndefined();
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      const dbUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        nickname: 'Test User',
        avatar: null,
        type: 'admin',
        permissions: [], // Drizzle with mode: 'json' returns native arrays
        password: 'hashedpassword',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      databaseMock.setQueryResult([dbUser]);

      const result = await service.findOne(1);

      expect(result).toMatchObject({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        nickname: 'Test User',
        type: 'admin',
        permissions: undefined, // Empty array is converted to undefined by mapToEntity
      });
      expect(result.password).toBeUndefined();
    });

    it('should throw NotFoundException if user not found', async () => {
      databaseMock.setQueryResult([]);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByUsername', () => {
    it('should return a user by username', async () => {
      const dbUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        nickname: 'Test User',
        avatar: null,
        type: 'admin',
        permissions: [], // Drizzle with mode: 'json' returns native arrays
        password: 'hashedpassword',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      databaseMock.setQueryResult([dbUser]);

      const result = await service.findByUsername('testuser');

      expect(result).toMatchObject({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        nickname: 'Test User',
        type: 'admin',
        permissions: undefined, // Empty array is converted to undefined by mapToEntity
      });
      expect(result?.password).toBeUndefined(); // password should not be included
    });

    it('should return null if user not found', async () => {
      databaseMock.setQueryResult([]);

      const result = await service.findByUsername('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a user successfully', async () => {
      const updateData = {
        nickname: 'Updated User',
        email: 'updated@example.com',
      };

      const updatedDbUser = {
        id: 1,
        username: 'testuser',
        nickname: 'Updated User',
        email: 'updated@example.com',
        avatar: null,
        type: 'admin',
        permissions: [], // Drizzle with mode: 'json' returns native arrays
        password: 'hashedpassword',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      databaseMock.setUpdateResult([updatedDbUser]);

      const result = await service.update(1, updateData);

      expect(result).toMatchObject({
        id: 1,
        username: 'testuser',
        nickname: 'Updated User',
        email: 'updated@example.com',
        type: 'admin',
        permissions: undefined, // Empty array is converted to undefined by mapToEntity
      });
      expect(result.password).toBeUndefined(); // password should not be included
      expect(databaseMock.db.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      databaseMock.setUpdateResult([]);

      await expect(service.update(999, { nickname: 'Test' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a user successfully', async () => {
      databaseMock.setDeleteResult(1);

      await service.remove(1);

      expect(databaseMock.db.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      databaseMock.setDeleteResult(0);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
