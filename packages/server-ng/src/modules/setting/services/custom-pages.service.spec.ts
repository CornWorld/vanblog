import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { DATABASE_CONNECTION } from '../../../database';

import { CustomPagesService } from './custom-pages.service';

describe('CustomPagesService', () => {
  let service: CustomPagesService;
  let mockDb: Record<string, ReturnType<typeof vi.fn>>;

  const mockPageRow = {
    id: 1,
    name: 'Test Page',
    path: '/test',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  const mockPageResponse = {
    id: '1',
    name: 'Test Page',
    path: '/test',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  function createChainedMock(result: unknown[]) {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(result),
      set: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue(result),
    };
    return chain;
  }

  beforeEach(async () => {
    const selectChain = createChainedMock([mockPageRow]);
    const insertChain = createChainedMock([mockPageRow]);
    const updateChain = createChainedMock([mockPageRow]);
    const deleteChain = {
      where: vi.fn().mockResolvedValue(undefined),
    };

    mockDb = {
      select: vi.fn().mockReturnValue(selectChain),
      insert: vi.fn().mockReturnValue(insertChain),
      update: vi.fn().mockReturnValue(updateChain),
      delete: vi.fn().mockReturnValue(deleteChain),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomPagesService, { provide: DATABASE_CONNECTION, useValue: mockDb }],
    }).compile();

    service = module.get<CustomPagesService>(CustomPagesService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllCustomPages', () => {
    it('should return all pages with id as string', async () => {
      const selectChain = createChainedMock([]);
      // Override: getAllCustomPages calls .from() which returns the array directly
      selectChain.from.mockResolvedValue([mockPageRow]);
      mockDb.select.mockReturnValue(selectChain);

      const result = await service.getAllCustomPages();
      expect(result).toEqual([mockPageResponse]);
      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe('getCustomPageByPath', () => {
    it('should throw NotFoundException when page not found', async () => {
      const selectChain = createChainedMock([]);
      selectChain.limit.mockResolvedValue([]);
      mockDb.select.mockReturnValue(selectChain);

      await expect(service.getCustomPageByPath('/nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createCustomPage', () => {
    it('should call db.insert with correct values', async () => {
      const result = await service.createCustomPage('Test Page', '/test');
      expect(mockDb.insert).toHaveBeenCalled();
      expect(result.id).toBe('1');
      expect(result.name).toBe('Test Page');
    });
  });

  describe('updateCustomPage', () => {
    it('should throw NotFoundException when page not found', async () => {
      const updateChain = createChainedMock([]);
      updateChain.returning.mockResolvedValue([]);
      mockDb.update.mockReturnValue(updateChain);

      await expect(service.updateCustomPage('999', { name: 'Updated' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteCustomPage', () => {
    it('should call db.delete', async () => {
      await service.deleteCustomPage('/test');
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe('getCustomPageContent', () => {
    it('should throw NotFoundException when page not found', async () => {
      const selectChain = createChainedMock([]);
      selectChain.limit.mockResolvedValue([]);
      mockDb.select.mockReturnValue(selectChain);

      await expect(service.getCustomPageContent('/nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateCustomPageContent', () => {
    it('should throw NotFoundException when page not found', async () => {
      const updateChain = createChainedMock([]);
      updateChain.returning.mockResolvedValue([]);
      mockDb.update.mockReturnValue(updateChain);

      await expect(
        service.updateCustomPageContent('/nonexistent', '<h1>Test</h1>'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
