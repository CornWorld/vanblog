import * as crypto from 'crypto';
import * as path from 'path';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * CDN 配置接口
 */
interface CDNConfig {
  enabled: boolean;
  baseUrl: string;
  domains: string[];
  enableImageOptimization: boolean;
  enableWebP: boolean;
  cacheTTL: number;
  purgeApiKey?: string;
  purgeEndpoint?: string;
}

/**
 * 图片优化参数
 */
interface ImageOptimizationParams {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png' | 'auto';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

/**
 * CDN 集成服务
 * 提供静态资源 CDN 分发和优化功能
 */
@Injectable()
export class CDNService {
  private readonly logger = new Logger(CDNService.name);
  private readonly config: CDNConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      enabled: this.configService.get<boolean>('CDN_ENABLED', false),
      baseUrl: this.configService.get<string>('CDN_BASE_URL', ''),
      domains: this.configService.get<string>('CDN_DOMAINS', '').split(',').filter(Boolean),
      enableImageOptimization: this.configService.get<boolean>('CDN_IMAGE_OPTIMIZATION', true),
      enableWebP: this.configService.get<boolean>('CDN_WEBP_ENABLED', true),
      cacheTTL: this.configService.get<number>('CDN_CACHE_TTL', 86400), // 24小时
      purgeApiKey: this.configService.get<string>('CDN_PURGE_API_KEY'),
      purgeEndpoint: this.configService.get<string>('CDN_PURGE_ENDPOINT'),
    };
  }

  /**
   * 获取资源的 CDN URL
   */
  getResourceUrl(resourcePath: string, optimization?: ImageOptimizationParams): string {
    if (!this.config.enabled || this.config.baseUrl === '' || this.config.baseUrl.trim() === '') {
      return resourcePath;
    }

    // 移除开头的斜杠
    const cleanPath = resourcePath.startsWith('/') ? resourcePath.slice(1) : resourcePath;

    // 使用域名分片来分散负载
    const domain = this.getShardedDomain(cleanPath);
    let url = `${domain}/${cleanPath}`;

    // 如果是图片且启用了优化
    if (this.isImage(cleanPath) && this.config.enableImageOptimization && optimization) {
      url = this.buildOptimizedImageUrl(url, optimization);
    }

    return url;
  }

  /**
   * 获取分片域名
   */
  private getShardedDomain(resourcePath: string): string {
    if (this.config.domains.length === 0) {
      return this.config.baseUrl;
    }

    // 基于文件路径的哈希来选择域名，确保同一文件总是使用同一域名
    const hash = crypto.createHash('md5').update(resourcePath).digest('hex');
    const index = parseInt(hash.slice(0, 8), 16) % this.config.domains.length;
    return this.config.domains[index];
  }

  /**
   * 构建优化的图片 URL
   */
  private buildOptimizedImageUrl(baseUrl: string, params: ImageOptimizationParams): string {
    const queryParams = new URLSearchParams();

    if (typeof params.width === 'number' && params.width > 0) {
      queryParams.set('w', params.width.toString());
    }

    if (typeof params.height === 'number' && params.height > 0) {
      queryParams.set('h', params.height.toString());
    }

    if (params.quality && params.quality >= 1 && params.quality <= 100) {
      queryParams.set('q', params.quality.toString());
    }

    if (typeof params.format === 'string' && params.format.length > 0) {
      queryParams.set('f', params.format);
    } else if (this.config.enableWebP) {
      queryParams.set('f', 'auto'); // 自动选择最佳格式
    }

    if (typeof params.fit === 'string' && params.fit.length > 0) {
      queryParams.set('fit', params.fit);
    }

    const queryString = queryParams.toString();
    return queryString.length > 0 ? `${baseUrl}?${queryString}` : baseUrl;
  }

  /**
   * 检查是否为图片文件
   */
  private isImage(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff'].includes(ext);
  }

  /**
   * 预热 CDN 缓存
   */
  async warmupCache(urls: string[]): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    this.logger.log(`Warming up CDN cache for ${urls.length} URLs`);

    const promises = urls.map(async (url) => {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        if (!response.ok) {
          this.logger.warn(`Failed to warmup cache for ${url}: ${response.status}`);
        }
      } catch (error) {
        this.logger.error(`Error warming up cache for ${url}:`, error);
      }
    });

    await Promise.allSettled(promises);
    this.logger.log('CDN cache warmup completed');
  }

  /**
   * 清除 CDN 缓存
   */
  async purgeCache(urls: string[]): Promise<boolean> {
    if (
      !this.config.enabled ||
      this.config.purgeEndpoint === undefined ||
      this.config.purgeApiKey === undefined
    ) {
      this.logger.warn('CDN purge not configured');
      return false;
    }

    try {
      const response = await fetch(this.config.purgeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.purgeApiKey}`,
        },
        body: JSON.stringify({ urls }),
      });

      if (response.ok) {
        this.logger.log(`Successfully purged ${urls.length} URLs from CDN cache`);
        return true;
      } else {
        this.logger.error(`Failed to purge CDN cache: ${response.status} ${response.statusText}`);
        return false;
      }
    } catch (error) {
      this.logger.error('Error purging CDN cache:', error);
      return false;
    }
  }

  /**
   * 清除所有缓存
   */
  async purgeAllCache(): Promise<boolean> {
    if (
      !this.config.enabled ||
      this.config.purgeEndpoint === undefined ||
      this.config.purgeApiKey === undefined
    ) {
      this.logger.warn('CDN purge not configured');
      return false;
    }

    try {
      const response = await fetch(this.config.purgeEndpoint, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.config.purgeApiKey}`,
        },
      });

      if (response.ok) {
        this.logger.log('Successfully purged all CDN cache');
        return true;
      } else {
        this.logger.error(
          `Failed to purge all CDN cache: ${response.status} ${response.statusText}`,
        );
        return false;
      }
    } catch (error) {
      this.logger.error('Error purging all CDN cache:', error);
      return false;
    }
  }

  /**
   * 获取 CDN 统计信息
   */
  getCDNStats(): {
    enabled: boolean;
    baseUrl: string;
    domainCount: number;
    imageOptimization: boolean;
    webpEnabled: boolean;
    cacheTTL: number;
  } {
    return {
      enabled: this.config.enabled,
      baseUrl: this.config.baseUrl,
      domainCount: this.config.domains.length,
      imageOptimization: this.config.enableImageOptimization,
      webpEnabled: this.config.enableWebP,
      cacheTTL: this.config.cacheTTL,
    };
  }

  /**
   * 生成响应式图片 URL 集合
   */
  generateResponsiveImageUrls(
    imagePath: string,
    sizes: number[] = [320, 640, 768, 1024, 1280, 1920],
  ): Array<{ url: string; width: number }> {
    return sizes.map((width) => ({
      url: this.getResourceUrl(imagePath, { width, format: 'auto', quality: 80 }),
      width,
    }));
  }

  /**
   * 生成图片 srcset 字符串
   */
  generateSrcSet(imagePath: string, sizes: number[] = [320, 640, 768, 1024, 1280, 1920]): string {
    const urls = this.generateResponsiveImageUrls(imagePath, sizes);
    return urls.map(({ url, width }) => `${url} ${width}w`).join(', ');
  }
}
