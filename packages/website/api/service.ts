import { apiClient } from './client';
import { tsRestClient } from './ts-rest-client';
import dayjs from 'dayjs';
import type {
  ArticleResponse,
  ArticleDetail,
  PublicMetaProp,
  CustomPageList,
  CustomPage,
} from '../types/api';
import type { Article } from '../types/article';
import type { PageViewDataContract } from '../types/contracts';
import { normalizeAnalyticsOverview, normalizeArticleStats } from '../types/contracts';

/**
 * Comprehensive API service for VanBlog public API
 * Based on the following endpoints:
 * API 服务类
 *
 * 提供对 VanBlog API 的访问，包括以下端点：
 * - GET /api/v2/articles
 * - GET /api/v2/articles/{id}
 * - POST /api/v2/articles/{id}
 * - GET /api/v2/articles/viewer/{id}
 * - GET /api/v2/public/search
 * - GET /api/v2/public/timeline
 * - GET /api/v2/public/category
 * - GET /api/v2/public/tag
 * - GET /api/v2/public/tag/{name}
 * - GET /api/v2/public/meta
 * - GET /api/v2/public/viewer
 * - POST /api/v2/public/viewer
 * - GET /api/v2/public/customPage/all
 * - GET /api/v2/public/customPage
 */
export class ApiService {
  private static instance: ApiService;

  private constructor() {}

  static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  private mapArticle(item: { [key: string]: unknown } | null | undefined): Article {
    if (!item) return null as unknown as Article;
    const tags =
      (item as { tags?: Array<{ name: string }> }).tags?.map((t: { name: string }) => t.name) || [];
    const views = (item as { views?: number }).views ?? 0;
    const isTop = (item as { isTop?: boolean }).isTop ?? false;
    const isPrivate = (item as { private?: boolean }).private ?? false;
    const author = (item as { author?: string }).author ?? 'Admin';
    const createdRaw = (item as { createdAt?: string | number | Date }).createdAt;
    const updatedRaw = (item as { updatedAt?: string | number | Date }).updatedAt;
    const createdAt =
      createdRaw != null
        ? dayjs(createdRaw as string | number | Date).toISOString()
        : dayjs().toISOString();
    const updatedAt =
      updatedRaw != null
        ? dayjs(updatedRaw as string | number | Date).toISOString()
        : dayjs().toISOString();
    return {
      ...(item as Record<string, unknown>),
      tags,
      viewer: views,
      top: isTop ? 1 : 0,
      hidden: isPrivate,
      author,
      createdAt,
      updatedAt,
    } as unknown as Article;
  }

  // Cache Management
  clearCache(): void {
    apiClient.clearCache();
  }

  invalidateCache(
    endpoint: string,
    params?: Record<
      string,
      | string
      | number
      | boolean
      | null
      | undefined
      | Array<string | number | boolean | null | undefined>
    >,
  ): void {
    apiClient.invalidateCache(endpoint, params);
  }

  // Articles
  async getArticles(
    options: {
      page?: number;
      pageSize?: number;
      sortBy?: string;
      sortOrder?: 'ASC' | 'DESC';
      category?: string;
      tag?: string;
      keyword?: string;
    } = {},
  ): Promise<ArticleResponse> {
    try {
      const { body, status } = await tsRestClient.getPublicArticles({
        query: {
          page: options.page,
          pageSize: options.pageSize,
          category: options.category,
          tag: options.tag,
        },
      });

      if (status === 200) {
        console.log(
          `[ApiService] getArticles successfully retrieved ${
            Array.isArray(body.items) ? body.items.length : 'unknown'
          } articles`,
        );

        return {
          data: body.items.map((item) => this.mapArticle(item)),
          total: body.total,
          page: body.page,
          pageSize: body.pageSize,
        };
      }

      console.warn('[ApiService] Response does not have expected v2 structure:', body);
      return {
        data: [],
        total: 0,
        page: options.page || 1,
        pageSize: options.pageSize || 10,
      };
    } catch (error) {
      console.error('[ApiService] getArticles error:', error);

      return {
        data: [],
        total: 0,
        page: options.page || 1,
        pageSize: options.pageSize || 10,
      };
    }
  }

  async getArticleByIdOrPathname(idOrPathname: string | number): Promise<ArticleDetail> {
    try {
      console.log(`[ApiService] Fetching article with ID or pathname: ${idOrPathname}`);
      const { body, status } = await tsRestClient.getPublicArticle({
        params: { idOrPathname: String(idOrPathname) },
      });

      if (status === 200) {
        const result = {
          ...this.mapArticle(body.article),
          prev: body.pre ? this.mapArticle(body.pre) : undefined,
          next: body.next ? this.mapArticle(body.next) : undefined,
        };

        console.log(
          `[ApiService] Successfully fetched article "${result.title}" (ID: ${result.id})`,
        );
        return result as ArticleDetail;
      }

      throw new Error('Failed to fetch article');
    } catch (error) {
      console.error(`[ApiService] Error fetching article with ID ${idOrPathname}:`, error);

      return {
        id: 0,
        title: 'Error Loading Article',
        content: 'There was an error loading this article. Please try again later.',
        createdAt: dayjs().toISOString(),
        updatedAt: dayjs().toISOString(),
        category: '',
        tags: [],
        private: false,
        author: 'System',
        top: 0,
        hidden: false,
        viewer: 0,
        date: dayjs().toISOString(),
        hide: false,
        secret: false,
      };
    }
  }

  async getEncryptedArticle(
    idOrPathname: string | number,
    password: string,
  ): Promise<ArticleDetail> {
    let articleId = String(idOrPathname);

    if (isNaN(Number(idOrPathname))) {
      const article = await this.getArticleByIdOrPathname(idOrPathname);
      articleId = article.id.toString();
    }

    const { body, status } = await tsRestClient.getEncryptedArticle({
      params: { id: articleId },
      body: { password },
    });

    if (status === 200) {
      const item = body as unknown as {
        tags?: Array<{ name: string }>;
        views?: number;
        isTop?: boolean;
        private?: boolean;
        author?: string;
        createdAt: unknown;
        updatedAt: unknown;
      } & Record<string, unknown>;
      return {
        ...item,
        tags: item.tags?.map((t: { name: string }) => t.name) || [],
        viewer: item.views || 0,
        top: item.isTop ? 1 : 0,
        hidden: item.private || false,
        author: item.author || 'Admin',
        createdAt: dayjs(item.createdAt as string | number | Date).toISOString(),
        updatedAt: dayjs(item.updatedAt as string | number | Date).toISOString(),
      } as ArticleDetail;
    }
    throw new Error('Failed to verify password');
  }

  async getArticleViewer(idOrPathname: string | number): Promise<PageViewDataContract> {
    const { body, status } = await tsRestClient.getArticleViewer({
      params: { id: String(idOrPathname) },
    });

    if (status === 200 && body) {
      const stats = normalizeArticleStats(body);
      return {
        viewer: stats.views,
        visited: stats.uniqueVisitors,
      };
    }
    return { viewer: 0, visited: 0 };
  }

  // Timeline, Categories and Tags
  async getTimeline(): Promise<Record<string, Article[]>> {
    const { body, status } = await tsRestClient.getPublicTimeline();
    if (status === 200) {
      const result: Record<string, Article[]> = {};
      for (const [key, items] of Object.entries(body)) {
        result[key] = items.map((item) => this.mapArticle(item));
      }
      return result;
    }
    return {};
  }

  async getCategories(): Promise<Record<string, Article[]>> {
    const { body, status } = await tsRestClient.getPublicCategories();
    if (status === 200) {
      const result: Record<string, Article[]> = {};
      for (const [key, items] of Object.entries(body)) {
        result[key] = items.map((item) => this.mapArticle(item));
      }
      return result;
    }
    return {};
  }

  async getTags(): Promise<Record<string, Article[]>> {
    const { body, status } = await tsRestClient.getPublicTags();
    if (status === 200) {
      const result: Record<string, Article[]> = {};
      for (const [key, items] of Object.entries(body)) {
        result[key] = items.map((item) => this.mapArticle(item));
      }
      return result;
    }
    return {};
  }

  async getArticlesByTag(tag: string): Promise<Article[]> {
    const groupedArticles = await this.getTags();
    return groupedArticles[tag] || [];
  }

  // Search
  async searchArticles(keyword: string): Promise<ArticleResponse> {
    const { body, status } = await tsRestClient.searchPublicArticles({
      query: { keyword },
    });

    if (status === 200) {
      return {
        data: body.items.map((item) => this.mapArticle(item)),
        total: body.total,
        page: body.page,
        pageSize: body.pageSize,
      };
    }
    return { data: [], total: 0, page: 1, pageSize: 10 };
  }

  // Meta
  async getMeta(): Promise<PublicMetaProp> {
    const { body, status } = await tsRestClient.getPublicMeta();
    if (status === 200) {
      return body;
    }
    throw new Error('Failed to get meta');
  }

  // Page Views
  async getPageView(): Promise<PageViewDataContract> {
    const { body, status } = await tsRestClient.getPublicViewer();
    if (status === 200) {
      const overview = normalizeAnalyticsOverview(body);
      return {
        visited: overview.totalPageviews,
        viewer: overview.totalVisitors,
      };
    }
    return { visited: 0, viewer: 0 };
  }

  async updatePageView(options: {
    isNew: boolean;
    isNewByPath: boolean;
    articleId?: number;
  }): Promise<PageViewDataContract> {
    try {
      const path = typeof window !== 'undefined' ? window.location.pathname : undefined;
      const referrer = typeof document !== 'undefined' ? document.referrer || undefined : undefined;
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;

      await tsRestClient.recordPublicViewer({
        body: {
          type: 'pageview',
          path,
          referrer,
          userAgent,
          data: { articleId: options.articleId ?? 0 },
        },
      });
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          '[ApiService] updatePageView analytics/record failed, will fallback to overview',
          e,
        );
      }
    }

    return this.getPageView();
  }

  // Custom Pages
  async getAllCustomPages(): Promise<CustomPageList[]> {
    const { body, status } = await tsRestClient.getPublicCustomPages();
    if (status === 200) {
      return body.map((item) => ({
        path: item.path || '',
        name: item.name || '',
      }));
    }
    return [];
  }

  async getCustomPage(path: string): Promise<CustomPage> {
    const { body, status } = await tsRestClient.getPublicCustomPage({
      query: { path },
    });
    if (status === 200) {
      return {
        path: body.path || '',
        name: body.name || '',
        html: body.html || '',
      };
    }
    throw new Error('Failed to get custom page');
  }
}

// Export a singleton instance
export const apiService = ApiService.getInstance();
