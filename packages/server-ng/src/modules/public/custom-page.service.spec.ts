import { describe, it, expect, vi } from 'vitest';

import type { MarkdownService } from '../../shared/services/markdown.service';

import { CustomPageService } from './custom-page.service';

describe('CustomPageService', () => {
  describe('getAllCustomPages', () => {
    it('should return list of all custom pages', async () => {
      const mockPages = [
        { name: 'About', path: '/about' },
        { name: 'Contact', path: '/contact' },
      ];

      const mockDb: any = {
        select: () => ({
          from: () => Promise.resolve(mockPages),
        }),
      };

      const mockMarkdownService = {} as MarkdownService;
      const service = new CustomPageService(mockDb, mockMarkdownService);

      const result = await service.getAllCustomPages();

      expect(result).toEqual(mockPages);
    });

    it('should return empty array when no pages exist', async () => {
      const mockDb: any = {
        select: () => ({
          from: () => Promise.resolve([]),
        }),
      };

      const mockMarkdownService = {} as MarkdownService;
      const service = new CustomPageService(mockDb, mockMarkdownService);

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

      const mockDb: any = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve(mockPageData),
            }),
          }),
        }),
      };

      const mockMarkdownService = {
        renderMarkdown: vi.fn().mockReturnValue('<h1>About Us</h1><p>This is our story.</p>'),
      } as any;

      const service = new CustomPageService(mockDb, mockMarkdownService);
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

      const mockDb: any = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve(mockPageData),
            }),
          }),
        }),
      };

      const mockMarkdownService = {
        renderMarkdown: vi.fn(),
      } as any;

      const service = new CustomPageService(mockDb, mockMarkdownService);
      const result = await service.getCustomPageByPath('/contact');

      expect(result).toEqual({
        name: 'Contact',
        path: '/contact',
        html: '<div>Contact us</div>',
      });
      expect(mockMarkdownService.renderMarkdown).not.toHaveBeenCalled();
    });

    it('should return null when page not found', async () => {
      const mockDb: any = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
      };

      const mockMarkdownService = {} as MarkdownService;
      const service = new CustomPageService(mockDb, mockMarkdownService);

      const result = await service.getCustomPageByPath('/nonexistent');

      expect(result).toBeNull();
    });

    it('should use eq condition to filter by path', async () => {
      const mockDb: any = {
        select: vi.fn().mockReturnValue({
          from: () => ({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      };

      const mockMarkdownService = {} as MarkdownService;
      const service = new CustomPageService(mockDb, mockMarkdownService);

      await service.getCustomPageByPath('/test-path');

      expect(mockDb.select).toHaveBeenCalled();
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

      const mockDb: any = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve(mockPageData),
            }),
          }),
        }),
      };

      const mockMarkdownService = {
        renderMarkdown: vi.fn().mockReturnValue('<p>Special content</p>'),
      } as any;

      const service = new CustomPageService(mockDb, mockMarkdownService);
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

      const mockDb: any = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve(mockPageData),
            }),
          }),
        }),
      };

      const mockMarkdownService = {
        renderMarkdown: vi.fn().mockReturnValue(''),
      } as any;

      const service = new CustomPageService(mockDb, mockMarkdownService);
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
