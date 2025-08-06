import { Test } from '@nestjs/testing';
import { describe, it, beforeEach, expect, vi } from 'vitest';

import { CodeSnippetService } from '../services/code-snippet.service';

import { CodeSnippetController } from './code-snippet.controller';

import type { TestingModule } from '@nestjs/testing';

describe('CodeSnippetController', () => {
  let controller: CodeSnippetController;
  let mockCodeSnippetService: Partial<CodeSnippetService>;

  beforeEach(async () => {
    mockCodeSnippetService = {
      create: vi.fn(),
      findAll: vi.fn(),
      findOne: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      execute: vi.fn(),
      findByHook: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CodeSnippetController],
      providers: [
        {
          provide: CodeSnippetService,
          useValue: mockCodeSnippetService,
        },
      ],
    }).compile();

    controller = module.get<CodeSnippetController>(CodeSnippetController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a code snippet', async () => {
      const createDto = {
        name: 'Test Snippet',
        hookName: 'test-hook',
        hookType: 'action' as const,
        code: 'console.log("test");',
        enabled: true,
        timeout: 5000,
        priority: 10,
      };

      const expectedResult = {
        id: 1,
        ...createDto,
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCodeSnippetService.create = vi.fn().mockResolvedValue(expectedResult);

      const result = await controller.create(createDto);

      expect(mockCodeSnippetService.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findAll', () => {
    it('should return paginated code snippets', async () => {
      const query = {
        page: 1,
        limit: 10,
        hookName: 'test-hook',
      };

      const expectedResult = {
        data: [
          {
            id: 1,
            name: 'Test Snippet',
            hookName: 'test-hook',
            hookType: 'action',
            code: 'console.log("test");',
            enabled: true,
            timeout: 5000,
            priority: 10,
            description: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      mockCodeSnippetService.findAll = vi.fn().mockResolvedValue(expectedResult);

      const result = await controller.findAll(query);

      expect(mockCodeSnippetService.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findOne', () => {
    it('should return a single code snippet', async () => {
      const expectedResult = {
        id: 1,
        name: 'Test Snippet',
        hookName: 'test-hook',
        hookType: 'action',
        code: 'console.log("test");',
        enabled: true,
        timeout: 5000,
        priority: 10,
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCodeSnippetService.findOne = vi.fn().mockResolvedValue(expectedResult);

      const result = await controller.findOne(1);

      expect(mockCodeSnippetService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('update', () => {
    it('should update a code snippet', async () => {
      const updateDto = {
        name: 'Updated Snippet',
        code: 'console.log("updated");',
      };

      const expectedResult = {
        id: 1,
        name: 'Updated Snippet',
        hookName: 'test-hook',
        hookType: 'action',
        code: 'console.log("updated");',
        enabled: true,
        timeout: 5000,
        priority: 10,
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCodeSnippetService.update = vi.fn().mockResolvedValue(expectedResult);

      const result = await controller.update(1, updateDto);

      expect(mockCodeSnippetService.update).toHaveBeenCalledWith(1, updateDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('remove', () => {
    it('should delete a code snippet', async () => {
      mockCodeSnippetService.remove = vi.fn().mockResolvedValue(undefined);

      await controller.remove(1);

      expect(mockCodeSnippetService.remove).toHaveBeenCalledWith(1);
    });
  });

  describe('execute', () => {
    it('should execute a code snippet', async () => {
      const executeDto = {
        data: { test: 'value' },
        args: ['arg1', 'arg2'],
      };

      const expectedResult = {
        success: true,
        result: { output: 'test' },
        executionTime: 100,
      };

      mockCodeSnippetService.execute = vi.fn().mockResolvedValue(expectedResult);

      const result = await controller.execute(1, executeDto);

      expect(mockCodeSnippetService.execute).toHaveBeenCalledWith(1, executeDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findByHook', () => {
    it('should return code snippets for a specific hook', async () => {
      const expectedResult = [
        {
          id: 1,
          name: 'Test Snippet',
          hookName: 'test-hook',
          hookType: 'action',
          code: 'console.log("test");',
          enabled: true,
          timeout: 5000,
          priority: 10,
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockCodeSnippetService.findByHook = vi.fn().mockResolvedValue(expectedResult);

      const result = await controller.findByHook('test-hook', 'action');

      expect(mockCodeSnippetService.findByHook).toHaveBeenCalledWith('test-hook', 'action');
      expect(result).toEqual(expectedResult);
    });
  });
});
