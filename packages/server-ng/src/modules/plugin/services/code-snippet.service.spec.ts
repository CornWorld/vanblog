import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, expect, vi } from 'vitest';

import { DATABASE_CONNECTION } from '../../../database';

import { CodeSnippetService } from './code-snippet.service';
import { PluginContextFactory } from './plugin-context.service';

type MockDatabase = {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  offset: ReturnType<typeof vi.fn>;
};

describe('CodeSnippetService', () => {
  let service: CodeSnippetService;
  let mockDb: MockDatabase;
  let mockPluginContextFactory: Partial<PluginContextFactory>;

  beforeEach(async () => {
    // Create chainable mock database
    const createChainableMock = (): MockDatabase => {
      const mock = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
        set: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
      };
      return mock;
    };

    mockDb = createChainableMock();

    mockPluginContextFactory = {
      createContext: vi.fn().mockReturnValue({
        pluginId: 'test-plugin',
        logger: { log: vi.fn(), error: vi.fn() },
        config: { get: vi.fn() },
        data: { get: vi.fn(), set: vi.fn() },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CodeSnippetService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: PluginContextFactory,
          useValue: mockPluginContextFactory,
        },
      ],
    }).compile();

    service = module.get<CodeSnippetService>(CodeSnippetService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a code snippet successfully', async () => {
      const now = new Date();
      const createDto = {
        name: 'Test Snippet',
        description: 'Test description',
        hookName: 'test-hook',
        hookType: 'action' as const,
        priority: 10,
        code: 'console.log("test");',
        enabled: true,
        timeout: 5000,
      };

      const expectedResult = {
        id: 1,
        ...createDto,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      mockDb.returning.mockResolvedValueOnce([expectedResult]);

      const result = await service.create(createDto);

      expect(result).toEqual(expectedResult);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalled();
      expect(mockDb.returning).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid code syntax', async () => {
      const createDto = {
        name: 'Test Snippet',
        hookName: 'test-hook',
        hookType: 'action' as const,
        code: 'invalid javascript syntax {{{',
        enabled: true,
        timeout: 5000,
        priority: 10,
      };

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return a code snippet when found', async () => {
      const now = new Date();
      const expectedResult = {
        id: 1,
        name: 'Test Snippet',
        description: undefined,
        hookName: 'test-hook',
        hookType: 'action',
        code: 'console.log("test");',
        enabled: true,
        timeout: 5000,
        priority: 10,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      mockDb.limit.mockResolvedValueOnce([expectedResult]);

      const result = await service.findOne(1);

      expect(result).toEqual(expectedResult);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when code snippet not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a code snippet successfully', async () => {
      const updateDto = {
        name: 'Updated Snippet',
        code: 'console.log("updated");',
      };

      const now = new Date();
      const expectedResult = {
        id: 1,
        name: 'Updated Snippet',
        hookName: 'test-hook',
        hookType: 'action',
        code: 'console.log("updated");',
        enabled: true,
        timeout: 5000,
        priority: 10,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      mockDb.returning.mockResolvedValueOnce([expectedResult]);

      const result = await service.update(1, updateDto);

      expect(result).toEqual(expectedResult);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.returning).toHaveBeenCalled();
    });

    it('should throw NotFoundException when code snippet not found', async () => {
      mockDb.returning.mockResolvedValueOnce([]);

      await expect(service.update(999, { name: 'Updated' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a code snippet successfully', async () => {
      const deletedSnippet = {
        id: 1,
        name: 'Test Snippet',
        hookName: 'test-hook',
        hookType: 'action',
        code: 'console.log("test");',
        enabled: true,
        timeout: 5000,
        priority: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([deletedSnippet]);

      await service.remove(1);

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.returning).toHaveBeenCalled();
    });

    it('should throw NotFoundException when code snippet not found', async () => {
      mockDb.returning.mockResolvedValueOnce([]);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('executeCode', () => {
    it('should execute simple JavaScript code', async () => {
      const code = 'return data + 1;';
      const data = 5;

      const result = await service.executeCode(code, data);

      expect(result).toBe(6);
    });

    it('should handle code execution timeout', async () => {
      const code = 'while(true) {}';
      const timeout = 100;

      await expect(service.executeCode(code, undefined, [], timeout)).rejects.toThrow(/timed out/);
    });

    it('should handle code execution errors', async () => {
      const code = 'throw new Error("test error");';

      await expect(service.executeCode(code)).rejects.toThrow('test error');
    });
  });

  describe('findByHook', () => {
    it('should return code snippets for a specific hook', async () => {
      const now = new Date();
      const expectedResults = [
        {
          id: 1,
          name: 'Test Snippet 1',
          description: undefined,
          hookName: 'test-hook',
          hookType: 'action',
          code: undefined,
          priority: 10,
          enabled: true,
          timeout: undefined,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
        {
          id: 2,
          name: 'Test Snippet 2',
          description: undefined,
          hookName: 'test-hook',
          hookType: 'action',
          code: undefined,
          priority: 20,
          enabled: true,
          timeout: undefined,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      ];

      mockDb.orderBy.mockResolvedValueOnce(expectedResults);

      const result = await service.findByHook('test-hook', 'action');

      expect(result).toEqual(expectedResults);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.orderBy).toHaveBeenCalled();
    });
  });
});
