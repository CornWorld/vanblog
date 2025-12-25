import { describe, it, expect } from 'vitest';

// Import all setting DTOs
import { UpdateAboutSchema, type UpdateAboutDto } from './about.dto';
import { UpdateCustomCodeSchema, type UpdateCustomCodeDto } from './custom-code.dto';
import { CreateFriendLinkSchema, type CreateFriendLinkDto } from './friend-link.dto';
import { UpdateLayoutSchema, type UpdateLayoutDto } from './update-layout.dto';
import { UpdateSiteInfoSchema, type UpdateSiteInfoDto } from './update-site-info.dto';
import { UpdateThemeSchema, type UpdateThemeDto } from './update-theme.dto';

describe('Setting DTOs', () => {
  describe('UpdateAboutSchema', () => {
    it('should validate update about content', () => {
      const data = { content: '# About Us\n\nWelcome to our blog!' };
      const result = UpdateAboutSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe('# About Us\n\nWelcome to our blog!');
      }
    });

    it('should validate HTML content', () => {
      const data = { content: '<h1>About</h1><p>Welcome</p>' };
      const result = UpdateAboutSchema.safeParse(data);

      expect(result.success).toBe(true);
    });

    it('should reject missing content', () => {
      const data = {};
      const result = UpdateAboutSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should allow empty string content', () => {
      const data = { content: '' };
      const result = UpdateAboutSchema.safeParse(data);

      expect(result.success).toBe(true);
    });

    it('should reject non-string content', () => {
      const data = { content: 123 };
      const result = UpdateAboutSchema.safeParse(data);

      expect(result.success).toBe(false);
    });
  });

  describe('UpdateCustomCodeSchema', () => {
    it('should validate custom code with header code', () => {
      const data = { headerCode: '<script>console.log("header")</script>' };
      const result = UpdateCustomCodeSchema.safeParse(data);

      expect(result.success).toBe(true);
    });

    it('should validate custom code with footer code', () => {
      const data = { footerCode: '<script>console.log("footer")</script>' };
      const result = UpdateCustomCodeSchema.safeParse(data);

      expect(result.success).toBe(true);
    });

    it('should allow both header and footer code', () => {
      const data = {
        headerCode: '<script>header</script>',
        footerCode: '<script>footer</script>',
      };
      const result = UpdateCustomCodeSchema.safeParse(data);

      expect(result.success).toBe(true);
    });

    it('should allow empty strings', () => {
      const data = { headerCode: '', footerCode: '' };
      const result = UpdateCustomCodeSchema.safeParse(data);

      expect(result.success).toBe(true);
    });

    it('should allow empty object (no fields required)', () => {
      const data = {};
      const result = UpdateCustomCodeSchema.safeParse(data);

      expect(result.success).toBe(true);
    });
  });

  describe('CreateFriendLinkSchema', () => {
    it('should validate complete friend link', () => {
      const data = {
        name: 'Example Blog',
        url: 'https://example.com',
        description: 'A great blog',
        avatar: 'https://example.com/logo.png',
      };
      const result = CreateFriendLinkSchema.safeParse(data);

      expect(result.success).toBe(true);
    });

    it('should validate friend link with minimal fields', () => {
      const data = {
        name: 'Blog',
        url: 'https://blog.example.com',
      };
      const result = CreateFriendLinkSchema.safeParse(data);

      expect(result.success).toBe(true);
    });

    it('should require name field', () => {
      const data = { url: 'https://example.com' };
      const result = CreateFriendLinkSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should require url field', () => {
      const data = { name: 'Blog' };
      const result = CreateFriendLinkSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const data = {
        name: '',
        url: 'https://example.com',
      };
      const result = CreateFriendLinkSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should reject invalid URL', () => {
      const data = {
        name: 'Blog',
        url: 'not-a-url',
      };
      const result = CreateFriendLinkSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should validate optional description and avatar', () => {
      const data = {
        name: 'Blog',
        url: 'https://example.com',
        description: 'Description',
        avatar: 'https://example.com/logo.png',
      };
      const result = CreateFriendLinkSchema.safeParse(data);

      expect(result.success).toBe(true);
    });
  });

  describe('UpdateLayoutSchema', () => {
    it('should validate layout update with all fields', () => {
      const data = {
        showRecentPosts: true,
        recentPostsCount: 10,
        showCategories: true,
        showTags: true,
        showArchive: true,
        showAbout: true,
        showSearch: true,
      };
      const result = UpdateLayoutSchema.safeParse(data);

      expect(result.success).toBe(true);
    });

    it('should validate layout with minimum recent posts', () => {
      const data = {
        showRecentPosts: true,
        recentPostsCount: 1,
        showCategories: false,
        showTags: false,
        showArchive: false,
        showAbout: false,
        showSearch: false,
      };
      const result = UpdateLayoutSchema.safeParse(data);

      expect(result.success).toBe(true);
    });

    it('should validate layout with maximum recent posts', () => {
      const data = {
        showRecentPosts: true,
        recentPostsCount: 20,
        showCategories: true,
        showTags: true,
        showArchive: true,
        showAbout: true,
        showSearch: true,
      };
      const result = UpdateLayoutSchema.safeParse(data);

      expect(result.success).toBe(true);
    });

    it('should reject recent posts count above maximum', () => {
      const data = {
        showRecentPosts: true,
        recentPostsCount: 21,
        showCategories: true,
        showTags: true,
        showArchive: true,
        showAbout: true,
        showSearch: true,
      };
      const result = UpdateLayoutSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should reject recent posts count below minimum', () => {
      const data = {
        showRecentPosts: true,
        recentPostsCount: 0,
        showCategories: true,
        showTags: true,
        showArchive: true,
        showAbout: true,
        showSearch: true,
      };
      const result = UpdateLayoutSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should require all fields', () => {
      const data = { showRecentPosts: true };
      const result = UpdateLayoutSchema.safeParse(data);

      expect(result.success).toBe(false);
    });
  });

  describe('UpdateSiteInfoSchema', () => {
    it('should validate complete site info with siteName', () => {
      const data = {
        siteName: 'My Blog',
        siteDescription: 'A personal blog',
        siteUrl: 'https://myblog.com',
        authorName: 'John Doe',
        siteLogo: 'https://myblog.com/logo.png',
        siteFavicon: 'https://myblog.com/favicon.ico',
      };
      const result = UpdateSiteInfoSchema.safeParse(data);

      expect(result.success).toBe(true);
    });

    it('should validate partial site info with siteName', () => {
      const data = {
        siteName: 'My Blog',
        siteDescription: 'A personal blog',
      };
      const result = UpdateSiteInfoSchema.safeParse(data);

      expect(result.success).toBe(true);
    });

    it('should require siteName field', () => {
      const data = { siteDescription: 'A personal blog' };
      const result = UpdateSiteInfoSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should reject empty siteName', () => {
      const data = { siteName: '' };
      const result = UpdateSiteInfoSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should validate site URL with proper format', () => {
      const data = {
        siteName: 'Blog',
        siteUrl: 'https://example.com',
      };
      const result = UpdateSiteInfoSchema.safeParse(data);

      expect(result.success).toBe(true);
    });

    it('should allow all optional fields', () => {
      const data = {
        siteName: 'Blog',
        siteKeywords: 'tech,blog',
        authorEmail: 'test@example.com',
        authorBio: 'A bio',
      };
      const result = UpdateSiteInfoSchema.safeParse(data);

      expect(result.success).toBe(true);
    });
  });

  describe('UpdateThemeSchema', () => {
    it('should validate theme update', () => {
      const data = { theme: 'dark' };
      const result = UpdateThemeSchema.safeParse(data);

      expect(result.success).toBe(true);
    });

    it('should allow light theme', () => {
      const data = { theme: 'light' };
      const result = UpdateThemeSchema.safeParse(data);

      expect(result.success).toBe(true);
    });

    it('should require theme field', () => {
      const data = {};
      const result = UpdateThemeSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should reject empty theme', () => {
      const data = { theme: '' };
      const result = UpdateThemeSchema.safeParse(data);

      expect(result.success).toBe(false);
    });
  });

  describe('Type Inference', () => {
    it('should correctly infer UpdateAboutDto type', () => {
      const dto: UpdateAboutDto = { content: 'test' };
      expect(dto.content).toBe('test');
    });

    it('should correctly infer UpdateCustomCodeDto type', () => {
      const dto: UpdateCustomCodeDto = {
        headerCode: '<script></script>',
      };
      expect(dto.headerCode).toBe('<script></script>');
    });

    it('should correctly infer CreateFriendLinkDto type', () => {
      const dto: CreateFriendLinkDto = {
        name: 'Blog',
        url: 'https://example.com',
      };
      expect(dto.name).toBe('Blog');
    });

    it('should correctly infer UpdateLayoutDto type', () => {
      const dto: UpdateLayoutDto = { layout: 'grid' };
      expect(dto.layout).toBe('grid');
    });

    it('should correctly infer UpdateSiteInfoDto type', () => {
      const dto: UpdateSiteInfoDto = {
        siteName: 'Blog',
        siteDescription: 'Description',
      };
      expect(dto.siteName).toBe('Blog');
    });

    it('should correctly infer UpdateThemeDto type', () => {
      const dto: UpdateThemeDto = { theme: 'dark' };
      expect(dto.theme).toBe('dark');
    });
  });
});
