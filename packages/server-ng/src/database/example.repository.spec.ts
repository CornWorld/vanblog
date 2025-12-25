import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DATABASE_CONNECTION } from './constants';
import { ExampleRepository } from './example.repository';

describe('ExampleRepository', () => {
  let repository: ExampleRepository;
  let mockDb: any;

  beforeEach(async () => {
    // Create mock database with query builder pattern
    const mockSelect = vi.fn().mockReturnThis();
    const mockFrom = vi.fn().mockReturnThis();
    const mockWhere = vi.fn().mockReturnThis();
    const mockLimit = vi.fn().mockResolvedValue([{ id: 1, username: 'testuser' }]);
    const mockInsert = vi.fn().mockReturnThis();
    const mockValues = vi.fn().mockReturnThis();
    const mockReturning = vi.fn().mockResolvedValue([{ id: 1, username: 'newuser' }]);

    mockDb = {
      select: mockSelect,
      insert: mockInsert,
    };

    // Chain methods properly
    mockSelect.mockImplementation(() => ({
      from: mockFrom,
    }));

    mockFrom.mockImplementation(() => ({
      where: mockWhere,
    }));

    mockWhere.mockImplementation(() => ({
      limit: mockLimit,
    }));

    mockInsert.mockImplementation(() => ({
      values: mockValues,
    }));

    mockValues.mockImplementation(() => ({
      returning: mockReturning,
    }));

    // For getAllUsers - simpler select chain
    mockSelect.mockImplementation(() => ({
      from: vi.fn().mockResolvedValue([
        { id: 1, username: 'user1' },
        { id: 2, username: 'user2' },
      ]),
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExampleRepository,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    repository = module.get<ExampleRepository>(ExampleRepository);
  });

  describe('Constructor', () => {
    it('should be defined', () => {
      expect(repository).toBeDefined();
    });

    it('should inject database connection', () => {
      expect(repository).toBeInstanceOf(ExampleRepository);
    });
  });

  describe('findUserByUsername', () => {
    it('should find user by username', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([{ id: 1, username: 'testuser' }]);

      mockDb.select = mockSelect;
      mockSelect.mockImplementation(() => ({
        from: mockFrom,
      }));
      mockFrom.mockImplementation(() => ({
        where: mockWhere,
      }));
      mockWhere.mockImplementation(() => ({
        limit: mockLimit,
      }));

      const result = await repository.findUserByUsername('testuser');

      expect(result).toEqual({ id: 1, username: 'testuser' });
      expect(mockSelect).toHaveBeenCalled();
    });

    it('should return undefined if user not found', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);

      mockDb.select = mockSelect;
      mockSelect.mockImplementation(() => ({
        from: mockFrom,
      }));
      mockFrom.mockImplementation(() => ({
        where: mockWhere,
      }));
      mockWhere.mockImplementation(() => ({
        limit: mockLimit,
      }));

      const result = await repository.findUserByUsername('nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      const mockInsert = vi.fn().mockReturnThis();
      const mockValues = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockResolvedValue([{ id: 1, username: 'newuser' }]);

      mockDb.insert = mockInsert;
      mockInsert.mockImplementation(() => ({
        values: mockValues,
      }));
      mockValues.mockImplementation(() => ({
        returning: mockReturning,
      }));

      const userData = {
        username: 'newuser',
        password: 'password123',
      };

      const result = await repository.createUser(userData);

      expect(result).toEqual({ id: 1, username: 'newuser' });
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should create user with nickname', async () => {
      const mockInsert = vi.fn().mockReturnThis();
      const mockValues = vi.fn().mockReturnThis();
      const mockReturning = vi
        .fn()
        .mockResolvedValue([{ id: 1, username: 'newuser', nickname: 'Test User' }]);

      mockDb.insert = mockInsert;
      mockInsert.mockImplementation(() => ({
        values: mockValues,
      }));
      mockValues.mockImplementation(() => ({
        returning: mockReturning,
      }));

      const userData = {
        username: 'newuser',
        password: 'password123',
        nickname: 'Test User',
      };

      const result = await repository.createUser(userData);

      expect(result).toEqual({ id: 1, username: 'newuser', nickname: 'Test User' });
    });
  });

  describe('getAllUsers', () => {
    it('should return all users', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockResolvedValue([
        { id: 1, username: 'user1' },
        { id: 2, username: 'user2' },
      ]);

      mockDb.select = mockSelect;
      mockSelect.mockImplementation(() => ({
        from: mockFrom,
      }));

      const result = await repository.getAllUsers();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 1, username: 'user1' });
      expect(result[1]).toEqual({ id: 2, username: 'user2' });
    });

    it('should return empty array when no users exist', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockResolvedValue([]);

      mockDb.select = mockSelect;
      mockSelect.mockImplementation(() => ({
        from: mockFrom,
      }));

      const result = await repository.getAllUsers();

      expect(result).toEqual([]);
    });
  });
});
