import { Test, type TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { OptionsController } from './options.controller';
import { OptionsService } from './options.service';

const mockOptionsService = {
  getOptions: vi.fn(),
};

describe('OptionsController (Public)', () => {
  let controller: OptionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OptionsController],
      providers: [{ provide: OptionsService, useValue: mockOptionsService }],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<OptionsController>(OptionsController);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getOptions should pass query and wrap result', async () => {
    // include should be a comma-separated string that gets transformed to an array
    const query = { include: 'articles,siteMeta' };
    const data = { articles: { items: [], total: 0 }, siteMeta: { title: 'x' } };
    mockOptionsService.getOptions.mockResolvedValue(data);

    const result = await controller.getOptions(query);

    // After parsing, include becomes an array
    expect(mockOptionsService.getOptions).toHaveBeenCalledWith({
      include: ['articles', 'siteMeta'],
    });
    expect(result).toEqual({ statusCode: 200, data });
  });

  describe('getOptions with various includes', () => {
    it('should handle empty include string', async () => {
      const query = { include: '' };
      const data = {};
      mockOptionsService.getOptions.mockResolvedValue(data);

      const result = await controller.getOptions(query);

      expect(mockOptionsService.getOptions).toHaveBeenCalledWith({ include: [] });
      expect(result.statusCode).toBe(200);
      expect(result.data).toEqual({});
    });

    it('should handle single include', async () => {
      const query = { include: 'articles' };
      const data = { articles: { items: [], total: 0, page: 1, pageSize: 20 } };
      mockOptionsService.getOptions.mockResolvedValue(data);

      const result = await controller.getOptions(query);

      expect(mockOptionsService.getOptions).toHaveBeenCalledWith({
        include: ['articles'],
      });
      expect(result.statusCode).toBe(200);
    });

    it('should handle all possible includes', async () => {
      const query = {
        include: 'articles,categories,tags,siteMeta,navigation,friendLinks,walineConfig',
      };
      const data = {
        articles: { items: [], total: 0, page: 1, pageSize: 20 },
        categories: [],
        tags: [],
        siteMeta: { title: 'Blog' },
        navigation: [],
        friendLinks: [],
        walineConfig: { serverURL: 'https://waline.example.com' },
      };
      mockOptionsService.getOptions.mockResolvedValue(data);

      const result = await controller.getOptions(query);

      expect(mockOptionsService.getOptions).toHaveBeenCalledWith({
        include: [
          'articles',
          'categories',
          'tags',
          'siteMeta',
          'navigation',
          'friendLinks',
          'walineConfig',
        ],
      });
      expect(result.statusCode).toBe(200);
      expect(result.data).toHaveProperty('articles');
      expect(result.data).toHaveProperty('categories');
      expect(result.data).toHaveProperty('tags');
      expect(result.data).toHaveProperty('siteMeta');
      expect(result.data).toHaveProperty('navigation');
      expect(result.data).toHaveProperty('friendLinks');
      expect(result.data).toHaveProperty('walineConfig');
    });

    it('should handle undefined include', async () => {
      const query = {};
      const data = {};
      mockOptionsService.getOptions.mockResolvedValue(data);

      const result = await controller.getOptions(query);

      expect(result.statusCode).toBe(200);
      expect(mockOptionsService.getOptions).toHaveBeenCalled();
    });

    it('should handle include with special characters', async () => {
      const query = { include: 'categories,tags,siteMeta' };
      const data = {
        categories: [
          { name: 'Tech & Web', slug: 'tech-web', description: 'Technology & Web Development' },
        ],
        tags: [{ name: 'C++', slug: 'cpp' }],
        siteMeta: { title: "John's Blog" },
      };
      mockOptionsService.getOptions.mockResolvedValue(data);

      const result = await controller.getOptions(query);

      expect(result.statusCode).toBe(200);
      expect(result.data.categories).toBeDefined();
    });
  });

  describe('Response format', () => {
    it('should always return statusCode 200', async () => {
      const query = { include: 'articles' };
      const data = { articles: { items: [], total: 0, page: 1, pageSize: 20 } };
      mockOptionsService.getOptions.mockResolvedValue(data);

      const result = await controller.getOptions(query);

      expect(result.statusCode).toBe(200);
    });

    it('should wrap service response in data field', async () => {
      const query = { include: 'siteMeta' };
      const serviceResponse = { siteMeta: { title: 'My Blog', description: 'A great blog' } };
      mockOptionsService.getOptions.mockResolvedValue(serviceResponse);

      const result = await controller.getOptions(query);

      expect(result).toHaveProperty('statusCode');
      expect(result).toHaveProperty('data');
      expect(result.data).toEqual(serviceResponse);
    });

    it('should preserve nested structures in response', async () => {
      const query = { include: 'articles,categories' };
      const serviceResponse = {
        articles: {
          items: [
            { id: 1, title: 'Article 1', content: 'Content', published: true },
            { id: 2, title: 'Article 2', content: 'Content 2', published: false },
          ],
          total: 2,
          page: 1,
          pageSize: 20,
        },
        categories: [
          { name: 'Tech', slug: 'tech', description: 'Technology articles' },
          { name: 'Life', slug: 'life' },
        ],
      };
      mockOptionsService.getOptions.mockResolvedValue(serviceResponse);

      const result = await controller.getOptions(query);

      expect(result.data.articles?.items).toHaveLength(2);
      expect(result.data.categories).toHaveLength(2);
      expect(result.data.articles?.items?.[0]).toHaveProperty('id');
      expect(result.data.articles?.items?.[0]).toHaveProperty('title');
    });
  });

  describe('Error handling', () => {
    it('should propagate service errors', async () => {
      const query = { include: 'articles' };
      mockOptionsService.getOptions.mockRejectedValue(new Error('Service error'));

      await expect(controller.getOptions(query)).rejects.toThrow('Service error');
    });

    it('should handle validation errors from service', async () => {
      const query = { include: 'invalid' };
      mockOptionsService.getOptions.mockRejectedValue(new Error('Invalid include option'));

      await expect(controller.getOptions(query)).rejects.toThrow('Invalid include option');
    });
  });
});
