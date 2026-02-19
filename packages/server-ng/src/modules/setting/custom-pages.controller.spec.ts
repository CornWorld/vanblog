import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { CustomPagesAdminController } from './custom-pages.controller';
import { CustomPagesService } from './services/custom-pages.service';

describe('CustomPagesAdminController', () => {
  let controller: CustomPagesAdminController;
  let mockService: Record<string, ReturnType<typeof vi.fn>>;

  const mockPage = {
    id: '1',
    name: 'Test Page',
    path: '/test',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    mockService = {
      getAllCustomPages: vi.fn(),
      getCustomPageByPath: vi.fn(),
      createCustomPage: vi.fn(),
      updateCustomPage: vi.fn(),
      deleteCustomPage: vi.fn(),
      getCustomPageContent: vi.fn(),
      updateCustomPageContent: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomPagesAdminController],
      providers: [{ provide: CustomPagesService, useValue: mockService }],
    }).compile();

    controller = module.get<CustomPagesAdminController>(CustomPagesAdminController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAllCustomPages', () => {
    it('should return all custom pages', async () => {
      mockService.getAllCustomPages.mockResolvedValue([mockPage]);
      const result = await controller.getAllCustomPages();
      expect(result).toEqual([mockPage]);
      expect(mockService.getAllCustomPages).toHaveBeenCalled();
    });
  });

  describe('getCustomPage', () => {
    it('should return a custom page by path', async () => {
      mockService.getCustomPageByPath.mockResolvedValue(mockPage);
      const result = await controller.getCustomPage('/test');
      expect(result).toEqual(mockPage);
      expect(mockService.getCustomPageByPath).toHaveBeenCalledWith('/test');
    });

    it('should throw NotFoundException when path is empty', async () => {
      await expect(controller.getCustomPage('')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createCustomPage', () => {
    it('should create a custom page', async () => {
      mockService.createCustomPage.mockResolvedValue(mockPage);
      const result = await controller.createCustomPage({ name: 'Test Page', path: '/test' });
      expect(result).toEqual(mockPage);
      expect(mockService.createCustomPage).toHaveBeenCalledWith('Test Page', '/test');
    });
  });

  describe('updateCustomPage', () => {
    it('should update a custom page', async () => {
      const updated = { ...mockPage, name: 'Updated' };
      mockService.updateCustomPage.mockResolvedValue(updated);
      const result = await controller.updateCustomPage({ id: '1', name: 'Updated' });
      expect(result).toEqual(updated);
      expect(mockService.updateCustomPage).toHaveBeenCalledWith('1', {
        name: 'Updated',
        path: undefined,
      });
    });
  });

  describe('deleteCustomPage', () => {
    it('should delete a custom page', async () => {
      mockService.deleteCustomPage.mockResolvedValue(undefined);
      const result = await controller.deleteCustomPage('/test');
      expect(result).toEqual({ success: true });
      expect(mockService.deleteCustomPage).toHaveBeenCalledWith('/test');
    });

    it('should throw NotFoundException when path is empty', async () => {
      await expect(controller.deleteCustomPage('')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCustomPageFolder', () => {
    it('should return an empty array', () => {
      const result = controller.getCustomPageFolder('/');
      expect(result).toEqual([]);
    });
  });

  describe('getCustomPageFile', () => {
    it('should return page content', async () => {
      mockService.getCustomPageContent.mockResolvedValue('<h1>Hello</h1>');
      const result = await controller.getCustomPageFile('/test', 'index.html');
      expect(result).toBe('<h1>Hello</h1>');
      expect(mockService.getCustomPageContent).toHaveBeenCalledWith('/test');
    });

    it('should throw NotFoundException when path is empty', async () => {
      await expect(controller.getCustomPageFile('', 'index.html')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createCustomPageFile', () => {
    it('should return success (stub)', () => {
      const result = controller.createCustomPageFile('/test', 'subfolder');
      expect(result).toEqual({ success: true });
    });
  });

  describe('updateCustomPageFile', () => {
    it('should update page content', async () => {
      mockService.updateCustomPageContent.mockResolvedValue(undefined);
      const result = await controller.updateCustomPageFile({
        pathname: '/test',
        filePath: 'index.html',
        content: '<h1>Updated</h1>',
      });
      expect(result).toEqual({ success: true });
      expect(mockService.updateCustomPageContent).toHaveBeenCalledWith('/test', '<h1>Updated</h1>');
    });
  });
});
