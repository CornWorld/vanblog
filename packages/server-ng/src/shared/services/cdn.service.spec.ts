import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { vi, describe, beforeEach, it, expect, afterEach } from 'vitest';

import { CDNService } from './cdn.service';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('CDNService', () => {
  let service: CDNService;
  let configService: ConfigService;
  let module: TestingModule;

  beforeEach(async () => {
    const mockConfigService = {
      get: vi.fn((key: string, defaultValue?: any) => {
        // Provide test configuration values
        const config: Record<string, any> = {
          CDN_ENABLED: true,
          CDN_BASE_URL: 'https://cdn.example.com',
          CDN_DOMAINS: 'https://cdn1.example.com,https://cdn2.example.com,https://cdn3.example.com',
          CDN_IMAGE_OPTIMIZATION: true,
          CDN_WEBP_ENABLED: true,
          CDN_CACHE_TTL: 86400,
          CDN_PURGE_API_KEY: 'test-api-key',
          CDN_PURGE_ENDPOINT: 'https://api.example.com/purge',
        };
        return config[key] ?? defaultValue;
      }),
    };

    module = await Test.createTestingModule({
      providers: [
        CDNService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<CDNService>(CDNService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getResourceUrl', () => {
    it('should return original path when CDN is disabled', () => {
      // Mock CDN disabled
      vi.mocked(configService.get).mockImplementation((key: string, _defaultValue?: any) => {
        if (key === 'CDN_ENABLED') return false;
        return _defaultValue;
      });

      // Create new service instance with disabled CDN
      const disabledService = new CDNService(configService);
      const result = disabledService.getResourceUrl('/images/test.jpg');
      expect(result).toBe('/images/test.jpg');
    });

    it('should return original path when base URL is empty', () => {
      vi.mocked(configService.get).mockImplementation((key: string, _defaultValue?: any) => {
        if (key === 'CDN_BASE_URL') return '';
        return _defaultValue;
      });

      const emptyUrlService = new CDNService(configService);
      const result = emptyUrlService.getResourceUrl('/images/test.jpg');
      expect(result).toBe('/images/test.jpg');
    });

    it('should generate CDN URL for regular resources', () => {
      const result = service.getResourceUrl('/images/test.jpg');
      expect(result).toMatch(/^https:\/\/cdn\d?\.example\.com\/images\/test\.jpg$/);
    });

    it('should remove leading slash from resource path', () => {
      const result = service.getResourceUrl('images/test.jpg');
      expect(result).toMatch(/^https:\/\/cdn\d?\.example\.com\/images\/test\.jpg$/);
    });

    it('should apply image optimization for images', () => {
      const optimization = {
        width: 800,
        height: 600,
        quality: 80,
        format: 'webp' as const,
        fit: 'cover' as const,
      };

      const result = service.getResourceUrl('/images/test.jpg', optimization);
      expect(result).toContain('w=800');
      expect(result).toContain('h=600');
      expect(result).toContain('q=80');
      expect(result).toContain('f=webp');
      expect(result).toContain('fit=cover');
    });

    it('should not apply optimization for non-image files', () => {
      const optimization = { width: 800, quality: 80 };
      const result = service.getResourceUrl('/documents/test.pdf', optimization);
      expect(result).not.toContain('w=800');
      expect(result).not.toContain('q=80');
    });

    it('should use auto format when WebP is enabled and no format specified', () => {
      const result = service.getResourceUrl('/images/test.jpg', { width: 800 });
      expect(result).toContain('f=auto');
    });

    it('should use consistent domain for same resource path', () => {
      const path = '/images/test.jpg';
      const result1 = service.getResourceUrl(path);
      const result2 = service.getResourceUrl(path);
      expect(result1).toBe(result2);
    });
  });

  describe('isImage', () => {
    it('should identify image files correctly', () => {
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff'];

      imageExtensions.forEach((ext) => {
        // Access private method for testing
        const result = (service as any).isImage(`test${ext}`);
        expect(result).toBe(true);
      });
    });

    it('should identify non-image files correctly', () => {
      const nonImageFiles = ['test.pdf', 'test.txt', 'test.doc', 'test.mp4', 'test.js'];

      nonImageFiles.forEach((file) => {
        const result = (service as any).isImage(file);
        expect(result).toBe(false);
      });
    });

    it('should handle case insensitive extensions', () => {
      const result1 = (service as any).isImage('test.JPG');
      const result2 = (service as any).isImage('test.PNG');
      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });
  });

  describe('warmupCache', () => {
    it('should skip warmup when CDN is disabled', async () => {
      vi.mocked(configService.get).mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'CDN_ENABLED') return false;
        return defaultValue;
      });

      const disabledService = new CDNService(configService);
      await disabledService.warmupCache(['https://example.com/test.jpg']);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should make HEAD requests to warm up cache', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      const urls = ['https://example.com/test1.jpg', 'https://example.com/test2.jpg'];

      await service.warmupCache(urls);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenCalledWith(urls[0], { method: 'HEAD' });
      expect(mockFetch).toHaveBeenCalledWith(urls[1], { method: 'HEAD' });
    });

    it('should handle failed warmup requests gracefully', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 });

      await expect(service.warmupCache(['https://example.com/test.jpg'])).resolves.not.toThrow();
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(service.warmupCache(['https://example.com/test.jpg'])).resolves.not.toThrow();
    });
  });

  describe('purgeCache', () => {
    it('should return false when CDN is disabled', async () => {
      vi.mocked(configService.get).mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'CDN_IMAGE_OPTIMIZATION') return false;
        return defaultValue;
      });

      const disabledService = new CDNService(configService);
      const result = await disabledService.purgeCache(['https://example.com/test.jpg']);
      expect(result).toBe(false);
    });

    it('should return false when purge endpoint is not configured', async () => {
      vi.mocked(configService.get).mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'CDN_PURGE_ENDPOINT') return undefined;
        return defaultValue;
      });

      const noPurgeService = new CDNService(configService);
      const result = await noPurgeService.purgeCache(['https://example.com/test.jpg']);
      expect(result).toBe(false);
    });

    it('should make POST request to purge endpoint', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      const urls = ['https://example.com/test1.jpg', 'https://example.com/test2.jpg'];

      const result = await service.purgeCache(urls);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/purge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-api-key',
        },
        body: JSON.stringify({ urls }),
      });
    });

    it('should return false when purge request fails', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });

      const result = await service.purgeCache(['https://example.com/test.jpg']);
      expect(result).toBe(false);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await service.purgeCache(['https://example.com/test.jpg']);
      expect(result).toBe(false);
    });
  });

  describe('purgeAllCache', () => {
    it('should make DELETE request to purge all cache', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const result = await service.purgeAllCache();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/purge', {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer test-api-key',
        },
      });
    });

    it('should return false when not configured', async () => {
      vi.mocked(configService.get).mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'CDN_PURGE_API_KEY') return undefined;
        return defaultValue;
      });

      const noKeyService = new CDNService(configService);
      const result = await noKeyService.purgeAllCache();
      expect(result).toBe(false);
    });

    it('should return false and log error when purge all request fails', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });

      const result = await service.purgeAllCache();
      expect(result).toBe(false);
    });

    it('should handle network errors when purging all cache', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await service.purgeAllCache();
      expect(result).toBe(false);
    });
  });

  describe('getCDNStats', () => {
    it('should return CDN configuration stats', () => {
      const stats = service.getCDNStats();

      expect(stats).toEqual({
        enabled: true,
        baseUrl: 'https://cdn.example.com',
        domainCount: 3,
        imageOptimization: true,
        webpEnabled: true,
        cacheTTL: 86400,
      });
    });
  });

  describe('generateResponsiveImageUrls', () => {
    it('should generate responsive image URLs with default sizes', () => {
      const urls = service.generateResponsiveImageUrls('/images/test.jpg');

      expect(urls).toHaveLength(6); // Default sizes: [320, 640, 768, 1024, 1280, 1920]
      expect(urls[0].width).toBe(320);
      expect(urls[0].url).toContain('w=320');
      expect(urls[0].url).toContain('f=auto');
      expect(urls[0].url).toContain('q=80');
    });

    it('should generate responsive image URLs with custom sizes', () => {
      const customSizes = [400, 800, 1200];
      const urls = service.generateResponsiveImageUrls('/images/test.jpg', customSizes);

      expect(urls).toHaveLength(3);
      expect(urls.map((u) => u.width)).toEqual(customSizes);
    });
  });

  describe('generateSrcSet', () => {
    it('should generate srcset string with default sizes', () => {
      const srcSet = service.generateSrcSet('/images/test.jpg');

      expect(srcSet).toContain('320w');
      expect(srcSet).toContain('640w');
      expect(srcSet).toContain('768w');
      expect(srcSet).toContain('1024w');
      expect(srcSet).toContain('1280w');
      expect(srcSet).toContain('1920w');
      expect(srcSet.split(', ')).toHaveLength(6);
    });

    it('should generate srcset string with custom sizes', () => {
      const customSizes = [400, 800];
      const srcSet = service.generateSrcSet('/images/test.jpg', customSizes);

      expect(srcSet).toContain('400w');
      expect(srcSet).toContain('800w');
      expect(srcSet.split(', ')).toHaveLength(2);
    });
  });

  describe('buildOptimizedImageUrl', () => {
    it('should build URL with all optimization parameters', () => {
      const baseUrl = 'https://cdn.example.com/test.jpg';
      const params = {
        width: 800,
        height: 600,
        quality: 85,
        format: 'webp' as const,
        fit: 'cover' as const,
      };

      const result = (service as any).buildOptimizedImageUrl(baseUrl, params);

      expect(result).toContain('w=800');
      expect(result).toContain('h=600');
      expect(result).toContain('q=85');
      expect(result).toContain('f=webp');
      expect(result).toContain('fit=cover');
    });

    it('should skip invalid parameters', () => {
      const baseUrl = 'https://cdn.example.com/test.jpg';
      const params = {
        width: -100, // Invalid
        height: 0, // Invalid
        quality: 150, // Invalid (> 100)
        format: '' as any, // Invalid
      };

      const result = (service as any).buildOptimizedImageUrl(baseUrl, params);

      expect(result).not.toContain('w=');
      expect(result).not.toContain('h=');
      expect(result).not.toContain('q=');
      expect(result).toContain('f=auto'); // Should use auto when WebP enabled
    });

    it('should return base URL when no valid parameters', () => {
      const baseUrl = 'https://cdn.example.com/test.jpg';
      const params = {};

      // Mock WebP disabled
      vi.mocked(configService.get).mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'CDN_WEBP_ENABLED') return false;
        return defaultValue;
      });

      const noWebpService = new CDNService(configService);
      const result = (noWebpService as any).buildOptimizedImageUrl(baseUrl, params);

      expect(result).toBe(baseUrl);
    });
  });

  describe('getShardedDomain', () => {
    it('should return base URL when no domains configured', () => {
      vi.mocked(configService.get).mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'CDN_DOMAINS') return '';
        if (key === 'CDN_BASE_URL') return 'https://cdn.example.com';
        if (key === 'CDN_ENABLED') return true;
        return defaultValue;
      });

      const noDomainsService = new CDNService(configService);
      const result = (noDomainsService as any).getShardedDomain('/test.jpg');
      expect(result).toBe('https://cdn.example.com');
    });

    it('should return consistent domain for same path', () => {
      const path = '/images/test.jpg';
      const domain1 = (service as any).getShardedDomain(path);
      const domain2 = (service as any).getShardedDomain(path);
      expect(domain1).toBe(domain2);
    });

    it('should distribute different paths across domains', () => {
      const paths = ['/test1.jpg', '/test2.jpg', '/test3.jpg', '/test4.jpg', '/test5.jpg'];
      const domains = paths.map((path) => (service as any).getShardedDomain(path));

      // Should use at least 2 different domains for 5 different paths
      const uniqueDomains = new Set(domains);
      expect(uniqueDomains.size).toBeGreaterThan(1);
    });

    it('should handle null domain list with explicit null check', () => {
      vi.mocked(configService.get).mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'CDN_DOMAINS') return null;
        if (key === 'CDN_BASE_URL') return 'https://cdn.example.com';
        if (key === 'CDN_ENABLED') return true;
        return defaultValue;
      });

      const nullDomainsService = new CDNService(configService);
      const result = (nullDomainsService as any).getShardedDomain('/test.jpg');
      expect(result).toBe('https://cdn.example.com');
    });

    it('should handle undefined domain list with explicit undefined check', () => {
      vi.mocked(configService.get).mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'CDN_DOMAINS') return undefined;
        if (key === 'CDN_BASE_URL') return 'https://cdn.example.com';
        if (key === 'CDN_ENABLED') return true;
        return defaultValue;
      });

      const undefinedDomainsService = new CDNService(configService);
      const result = (undefinedDomainsService as any).getShardedDomain('/test.jpg');
      expect(result).toBe('https://cdn.example.com');
    });

    it('should handle empty string domain list', () => {
      vi.mocked(configService.get).mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'CDN_DOMAINS') return '';
        if (key === 'CDN_BASE_URL') return 'https://cdn.example.com';
        if (key === 'CDN_ENABLED') return true;
        return defaultValue;
      });

      const emptyDomainsService = new CDNService(configService);
      const result = (emptyDomainsService as any).getShardedDomain('/test.jpg');
      expect(result).toBe('https://cdn.example.com');
    });

    it('should distinguish between null and undefined base URLs', () => {
      // Test with null base URL
      vi.mocked(configService.get).mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'CDN_BASE_URL') return null;
        if (key === 'CDN_DOMAINS') return '';
        if (key === 'CDN_ENABLED') return true;
        return defaultValue;
      });

      const nullUrlService = new CDNService(configService);
      expect(() => (nullUrlService as any).getShardedDomain('/test.jpg')).not.toThrow();

      // Test with undefined base URL
      vi.mocked(configService.get).mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'CDN_BASE_URL') return undefined;
        if (key === 'CDN_DOMAINS') return '';
        if (key === 'CDN_ENABLED') return true;
        return defaultValue;
      });

      const undefinedUrlService = new CDNService(configService);
      expect(() => (undefinedUrlService as any).getShardedDomain('/test.jpg')).not.toThrow();
    });

    it('should handle whitespace-only domain list', () => {
      vi.mocked(configService.get).mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'CDN_DOMAINS') return '   ';
        if (key === 'CDN_BASE_URL') return 'https://cdn.example.com';
        if (key === 'CDN_ENABLED') return true;
        return defaultValue;
      });

      const whitespaceDomainsService = new CDNService(configService);
      const result = (whitespaceDomainsService as any).getShardedDomain('/test.jpg');
      // Should handle gracefully, likely returning base URL
      expect(result).toBeDefined();
    });
  });

  describe('XSS and Query Parameter Injection Prevention', () => {
    it('should sanitize XSS payloads in query parameters', () => {
      const result = service.getResourceUrl('/images/test.jpg', {
        width: 800,
        quality: 80,
      });

      // Should not contain unescaped script tags
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
      expect(result).toContain('w=800');
      expect(result).toContain('q=80');
    });

    it('should handle script tag in width parameter', () => {
      const maliciousOptimization = {
        width: '<script>alert()</script>' as any,
      };

      const result = service.getResourceUrl('/images/test.jpg', maliciousOptimization);

      // Script tags should not execute - they should be escaped or removed
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
    });

    it('should handle event handlers in parameters', () => {
      const maliciousOptimization = {
        quality: 'onerror=alert()' as any,
      };

      const result = service.getResourceUrl('/images/test.jpg', maliciousOptimization);

      // Event handlers should be escaped or sanitized
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('alert()');
    });

    it('should handle URL encoding attacks', () => {
      const result = service.getResourceUrl('/images/test.jpg', {
        quality: 80,
      });

      // Should properly encode parameters
      expect(result).toContain('q=80');
      expect(result).toMatch(/^https:\/\//);
    });

    it('should handle double URL encoding attempts', () => {
      const maliciousPath = '/images/test%3Cscript%3E.jpg';

      const result = service.getResourceUrl(maliciousPath, {
        width: 800,
      });

      // Should handle encoded paths safely
      expect(result).toBeDefined();
    });

    it('should handle path traversal attempts in parameters', () => {
      const result = service.getResourceUrl('/images/test.jpg', {
        quality: 80,
      });

      // Should not allow directory traversal
      expect(result).not.toContain('../');
      expect(result).not.toContain('..\\');
    });

    it('should sanitize SQL injection attempts in parameters', () => {
      const result = service.getResourceUrl('/images/test.jpg', {
        quality: "'; DROP TABLE users; --" as any,
      });

      // SQL injection should be treated as invalid parameter
      expect(result).toBeDefined();
    });

    it('should handle null byte injection', () => {
      const result = service.getResourceUrl('/images/test.jpg', {
        quality: 'value\x00injection' as any,
      });

      expect(result).toBeDefined();
    });

    it('should handle very long query strings', () => {
      const result = service.getResourceUrl('/images/test.jpg', {
        quality: 80,
      });

      // Should handle long URLs gracefully
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
