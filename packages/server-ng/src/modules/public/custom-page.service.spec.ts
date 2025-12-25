import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { DATABASE_CONNECTION } from '../../database';
import { MarkdownService } from '../../shared/services/markdown.service';

import { CustomPageService } from './custom-page.service';

const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
};

const mockMarkdownService = {
  renderMarkdown: vi.fn(),
};

describe('CustomPageService', () => {
  let service: CustomPageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomPageService,
        { provide: DATABASE_CONNECTION, useValue: mockDb },
        { provide: MarkdownService, useValue: mockMarkdownService },
      ],
    }).compile();

    service = module.get<CustomPageService>(CustomPageService);
    vi.clearAllMocks();

    // Reset mock chain
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.limit.mockReturnThis();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllCustomPages', () => {
    it('should return list of all custom pages', async () => {
      const mockPages = [
        { name: 'About', path: '/about' },
        { name: 'Contact', path: '/contact' },
      ];

      mockDb.from.mockResolvedValue(mockPages);

      const result = await service.getAllCustomPages();

      expect(result).toEqual(mockPages);
      expect(mockDb.select).toHaveBeenCalledWith({
        name: expect.anything(),
        path: expect.anything(),
      });
      expect(mockDb.from).toHaveBeenCalled();
    });

    it('should return empty array when no pages exist', async () => {
      mockDb.from.mockResolvedValue([]);

      const result = await service.getAllCustomPages();

      expect(result).toEqual([]);
    });
  });

  describe('getCustomPageByPath', () => {
    it('should return custom page with rendered markdown', async () => {
      const mockPageData = [
        {
          title: 'About',
          pathname: '/about',
          content: '# About Us\n\nThis is our story.',
          type: 'markdown',
        },
      ];

      mockDb.limit.mockResolvedValue(mockPageData);
      mockMarkdownService.renderMarkdown.mockReturnValue(
        '<h1>About Us</h1><p>This is our story.</p>',
      );

      const result = await service.getCustomPageByPath('/about');

      expect(result).toEqual({
        name: 'About',
        path: '/about',
        html: '<h1>About Us</h1><p>This is our story.</p>',
      });
      expect(mockMarkdownService.renderMarkdown).toHaveBeenCalledWith(
        '# About Us\n\nThis is our story.',
      );
    });

    it('should return custom page with raw HTML when type is not markdown', async () => {
      const mockPageData = [
        {
          title: 'Contact',
          pathname: '/contact',
          content: '<div>Contact us</div>',
          type: 'html',
        },
      ];

      mockDb.limit.mockResolvedValue(mockPageData);

      const result = await service.getCustomPageByPath('/contact');

      expect(result).toEqual({
        name: 'Contact',
        path: '/contact',
        html: '<div>Contact us</div>',
      });
      expect(mockMarkdownService.renderMarkdown).not.toHaveBeenCalled();
    });

    it('should return null when page not found', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await service.getCustomPageByPath('/nonexistent');

      expect(result).toBeNull();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalledWith(1);
    });

    it('should use eq condition to filter by path', async () => {
      mockDb.limit.mockResolvedValue([]);

      await service.getCustomPageByPath('/test-path');

      expect(mockDb.where).toHaveBeenCalled();
      // The where clause uses eq() from drizzle-orm
      const whereCall = mockDb.where.mock.calls[0][0];
      expect(whereCall).toBeDefined();
    });

    it('should handle special characters in path', async () => {
      const mockPageData = [
        {
          title: 'Special Page',
          pathname: '/special-@#$%',
          content: 'Special content',
          type: 'markdown',
        },
      ];

      mockDb.limit.mockResolvedValue(mockPageData);
      mockMarkdownService.renderMarkdown.mockReturnValue('<p>Special content</p>');

      const result = await service.getCustomPageByPath('/special-@#$%');

      expect(result).toEqual({
        name: 'Special Page',
        path: '/special-@#$%',
        html: '<p>Special content</p>',
      });
    });

    it('should handle empty content', async () => {
      const mockPageData = [
        {
          title: 'Empty Page',
          pathname: '/empty',
          content: '',
          type: 'markdown',
        },
      ];

      mockDb.limit.mockResolvedValue(mockPageData);
      mockMarkdownService.renderMarkdown.mockReturnValue('');

      const result = await service.getCustomPageByPath('/empty');

      expect(result).toEqual({
        name: 'Empty Page',
        path: '/empty',
        html: '',
      });
      expect(mockMarkdownService.renderMarkdown).toHaveBeenCalledWith('');
    });
  });
});
