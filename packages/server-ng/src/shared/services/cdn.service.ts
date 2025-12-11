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
 *
 * 提供静态资源 CDN 分发和优化功能，包括图片优化、缓存管理、
 * 域名分片和响应式图片生成等功能。
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
  /**
   * 获取资源的 CDN URL
   *
   * 根据配置将本地资源路径转换为 CDN URL，支持图片优化参数。
   * 如果 CDN 未启用，则返回原始路径。
   *
   * @param resourcePath 资源路径
   * @param optimization 图片优化参数（可选）
   * @returns CDN URL 或原始路径
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
   *
   * 基于资源路径的哈希值选择合适的 CDN 域名，实现负载均衡。
   * 确保相同资源始终使用相同域名，避免缓存失效。
   *
   * @param resourcePath 资源路径
   * @returns 选中的 CDN 域名
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
   * 构建优化图片 URL
   *
   * 根据优化参数构建图片处理 URL，支持尺寸调整、格式转换、
   * 质量压缩等功能。自动选择最佳格式以减少文件大小。
   *
   * @param baseUrl 基础 URL
   * @param params 优化参数
   * @returns 带优化参数的 URL
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
   * 检查文件是否为图片
   *
   * 根据文件扩展名判断是否为支持的图片格式。
   * 支持常见的 Web 图片格式。
   *
   * @param filePath 文件路径
   * @returns 是否为图片文件
   */
  private isImage(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff'].includes(ext);
  }

  /**
   * 预热 CDN 缓存
   *
   * 主动请求指定的 URL 列表，让 CDN 提前缓存这些资源，
   * 提高用户首次访问的速度。适合在发布新内容后使用。
   *
   * @param urls 需要预热的 URL 列表
   * @returns Promise，在所有预热请求完成后 resolve
   */
  async warmupCache(urls: string[]): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    this.logger.log(`Warming up CDN cache for ${String(urls.length)} URLs`);

    const promises = urls.map(async (url) => {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        if (!response.ok) {
          this.logger.warn(`Failed to warmup cache for ${url}: ${String(response.status)}`);
        }
      } catch (error) {
        this.logger.error(`Error warming up cache for ${url}:`, error);
      }
    });

    await Promise.allSettled(promises);
    this.logger.log('CDN cache warmup completed');
  }

  /**
   * 清除指定 URL 的 CDN 缓存
   *
   * 通过 CDN 提供商的 API 清除指定 URL 的缓存，
   * 强制 CDN 重新从源站获取最新内容。通常在内容更新后使用。
   *
   * @param urls 需要清除缓存的 URL 列表
   * @returns Promise<boolean> 清除操作是否成功
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
        this.logger.log(`Successfully purged ${String(urls.length)} URLs from CDN cache`);
        return true;
      } else {
        this.logger.error(
          `Failed to purge CDN cache: ${String(response.status)} ${response.statusText}`,
        );
        return false;
      }
    } catch (error) {
      this.logger.error('Error purging CDN cache:', error);
      return false;
    }
  }

  /**
   * 清除所有 CDN 缓存
   *
   * 清除整个 CDN 的所有缓存内容，通常在网站大规模更新时使用。
   * 注意：此操作会影响所有用户的访问速度，应谨慎使用。
   *
   * @returns Promise<boolean> 清除操作是否成功
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
          `Failed to purge all CDN cache: ${String(response.status)} ${response.statusText}`,
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
   *
   * 返回当前 CDN 配置的统计信息，用于监控和调试。
   *
   * @returns CDN 配置统计
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
   * 生成响应式图片 URL 列表
   *
   * 为指定图片生成不同尺寸的 URL，用于响应式图片显示。
   * 支持自定义尺寸列表，默认包含常用的响应式断点。
   *
   * @param imagePath 图片路径
   * @param sizes 图片宽度列表，默认包含常用的响应式断点
   * @returns Array<{url: string, width: number}> 包含 URL 和宽度的对象数组
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
   * 生成 HTML srcset 属性值
   *
   * 为指定图片生成符合 HTML srcset 规范的字符串，
   * 用于响应式图片的 img 标签。浏览器会根据设备屏幕自动选择最合适的图片。
   *
   * @param imagePath 图片路径
   * @param sizes 图片宽度列表，默认包含常用的响应式断点
   * @returns string srcset 属性值字符串，例如 "/img.jpg?w=320 320w, /img.jpg?w=640 640w"
   */
  generateSrcSet(imagePath: string, sizes: number[] = [320, 640, 768, 1024, 1280, 1920]): string {
    const urls = this.generateResponsiveImageUrls(imagePath, sizes);
    return urls.map(({ url, width }) => `${url} ${String(width)}w`).join(', ');
  }
}
