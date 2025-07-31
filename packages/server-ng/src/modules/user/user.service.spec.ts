import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserService } from './user.service';
import { UserType, type CreateUserDto } from './dto';
import { users } from '../../database/schema';

// Mock bcrypt
vi.mock('bcrypt');

describe('UserService', () => {
  let service: UserService;

  interface MockDb {
    select: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    all: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    values: ReturnType<typeof vi.fn>;
    returning: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  }

  let mockDb: MockDb;

  const mockUser = {
    id: 1,
    username: 'testuser',
    password: 'hashedPassword',
    nickname: 'Test User',
    email: 'test@example.com',
    avatar: null,
    type: 'admin',
    permissions: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      get: vi.fn(),
      all: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: 'DATABASE_CONNECTION',
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    const createUserDto: CreateUserDto = {
      username: 'testuser',
      password: 'password123',
      nickname: 'Test User',
      email: 'test@example.com',
      type: UserType.ADMIN,
    };

    it('should create a new user', async () => {
      mockDb.get.mockResolvedValueOnce(null);
      mockDb.get.mockResolvedValueOnce(mockUser);

      const result = await service.create(createUserDto);

      expect(vi.mocked(bcrypt.hash)).toHaveBeenCalledWith('password123', 10);
      expect(mockDb.insert).toHaveBeenCalledWith(users);
      expect(result.username).toBe('testuser');
      expect(result.password).toBe('hashedPassword');
    });

    it('should throw ConflictException if username exists', async () => {
      mockDb.get.mockResolvedValue(mockUser);

      await expect(service.create(createUserDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      mockDb.all.mockResolvedValue([mockUser]);

      const result = await service.findAll();

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(users);
      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('testuser');
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      mockDb.get.mockResolvedValue(mockUser);

      const result = await service.findOne(1);

      expect(mockDb.where).toHaveBeenCalled();
      expect(result.id).toBe(1);
      expect(result.username).toBe('testuser');
    });

    it('should throw NotFoundException if user not found', async () => {
      mockDb.get.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByUsername', () => {
    it('should return a user by username', async () => {
      mockDb.get.mockResolvedValue(mockUser);

      const result = await service.findByUsername('testuser');

      expect(mockDb.where).toHaveBeenCalled();
      expect(result?.username).toBe('testuser');
    });

    it('should return null if user not found', async () => {
      mockDb.get.mockResolvedValue(null);

      const result = await service.findByUsername('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      mockDb.returning.mockResolvedValue([{ ...mockUser, nickname: 'Updated' }]);

      const result = await service.update(1, { nickname: 'Updated' });

      expect(mockDb.update).toHaveBeenCalledWith(users);
      expect(result.nickname).toBe('Updated');
    });

    it('should hash password if provided', async () => {
      mockDb.returning.mockResolvedValue([mockUser]);

      await service.update(1, { password: 'newpassword' });

      expect(vi.mocked(bcrypt.hash)).toHaveBeenCalledWith('newpassword', 10);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockDb.returning.mockResolvedValue([]);

      await expect(service.update(999, { nickname: 'Test' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a user', async () => {
      mockDb.returning.mockResolvedValue([mockUser]);

      await service.remove(1);

      expect(mockDb.delete).toHaveBeenCalledWith(users);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockDb.returning.mockResolvedValue([]);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
