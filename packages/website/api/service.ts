import { apiClient } from './client';
import {
  ArticleResponse,
  ArticleDetail,
  PublicMetaProp,
  CustomPageList,
  CustomPage,
  ApiV2Response,
  PaginatedData,
} from '../types/api';
import { Article } from '../types/article';
import { PageViewData } from './types';

/**
 * Comprehensive API service for VanBlog public API
 * Based on the following endpoints:
 * API 服务类
 *
 * 提供对 VanBlog API 的访问，包括以下端点：
 * - GET /api/v2/public/article
 * - GET /api/v2/public/article/{id}
 * - POST /api/v2/public/article/{id}
 * - GET /api/v2/public/article/viewer/{id}
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
      const response = await apiClient.get<ApiV2Response<PaginatedData<Article>>>(
        '/api/v2/public/article',
        options,
        'getArticles',
      );

      // Validate response structure
      if (!response) {
        console.error('[ApiService] getArticles response is null or undefined');
        throw new Error('Invalid response from API');
      }

      if (!response.data) {
        console.error('[ApiService] getArticles response missing data:', response);
        throw new Error('Invalid response data structure');
      }

      // Handle v2 API response format
      if (response.statusCode === 200 && response.data.items) {
        console.log(
          `[ApiService] getArticles successfully retrieved ${
            Array.isArray(response.data.items) ? response.data.items.length : 'unknown'
          } articles`,
        );

        // Transform to expected ArticleResponse format for backward compatibility
        const result: ArticleResponse = {
          data: response.data.items,
          total: response.data.total,
          page: response.data.page,
          pageSize: response.data.pageSize,
        };
        return result;
      }

      // Fallback for unexpected response structure
      console.warn('[ApiService] Response does not have expected v2 structure:', response);
      return {
        data: [],
        total: 0,
        page: options.page || 1,
        pageSize: options.pageSize || 10,
      };
    } catch (error) {
      console.error('[ApiService] getArticles error:', error);

      // Return empty result instead of throwing to prevent component errors
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
      const response = await apiClient.get<{
        statusCode: number;
        data: { article: ArticleDetail; pre?: ArticleDetail | null; next?: ArticleDetail | null };
      }>(`/api/v2/public/article/${idOrPathname}`, {}, 'getArticleByIdOrPathname');

      if (!response) {
        console.error(`[ApiService] Article response is null or undefined for ID ${idOrPathname}`);
        throw new Error('Empty response from API');
      }

      if (!response.data) {
        console.error(`[ApiService] Article data is missing for ID ${idOrPathname}`, response);
        throw new Error('Missing article data in response');
      }

      // The actual article is inside response.data.article
      const articleData = response.data.article;

      if (!articleData) {
        console.error(
          `[ApiService] Article object is missing in response data for ID ${idOrPathname}`,
          response.data,
        );
        throw new Error('Missing article object in response data');
      }

      // Add prev/next data to the article if available
      const result = {
        ...articleData,
        prev: response.data.pre,
        next: response.data.next,
      };

      // Log some basic info about the article
      console.log(`[ApiService] Successfully fetched article "${result.title}" (ID: ${result.id})`);

      return result;
    } catch (error) {
      console.error(`[ApiService] Error fetching article with ID ${idOrPathname}:`, error);

      // Return a default "error" article that the UI can handle gracefully
      return {
        id: 0,
        title: 'Error Loading Article',
        content: 'There was an error loading this article. Please try again later.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        category: '',
        tags: [],
        private: false,
        author: 'System',
        top: 0,
        hidden: false,
        viewer: 0,
        date: new Date().toISOString(),
        hide: false,
        secret: false,
      };
    }
  }

  async getEncryptedArticle(
    idOrPathname: string | number,
    password: string,
  ): Promise<ArticleDetail> {
    // 支持两种方式：ID 或 pathname
    const id = typeof idOrPathname === 'number' ? idOrPathname : Number(idOrPathname);

    if (Number.isFinite(id)) {
      // 走按 ID 的流程
      const verify = await apiClient.post<{
        success: boolean;
        token?: string;
        message?: string;
        expiresAt?: string;
      }>(`/api/v2/articles/${id}/verify-password`, { password }, 'verifyArticlePassword');

      if (!verify || !verify.success || !verify.token) {
        const msg =
          verify && typeof verify.message === 'string' ? verify.message : 'Invalid password';
        throw new Error(`[ApiService] verify-password failed: ${msg}`);
      }

      const article = await apiClient.get<Article>(
        `/api/v2/articles/${id}`,
        undefined,
        'getEncryptedArticleWithToken',
        { Authorization: `Bearer ${verify.token}` },
      );

      return article as unknown as ArticleDetail;
    }

    // 非数字，按 pathname 进行验证与访问
    const pathname = String(idOrPathname);
    const verifyByPath = await apiClient.post<{
      success: boolean;
      token?: string;
      message?: string;
      expiresAt?: string;
    }>(
      `/api/v2/articles/by-path/${pathname}/verify-password`,
      { password },
      'verifyArticlePasswordByPathname',
    );

    if (!verifyByPath || !verifyByPath.success || !verifyByPath.token) {
      const msg =
        verifyByPath && typeof verifyByPath.message === 'string'
          ? verifyByPath.message
          : 'Invalid password';
      throw new Error(`[ApiService] verify-password(by-path) failed: ${msg}`);
    }

    const articleByPath = await apiClient.get<Article>(
      `/api/v2/articles/by-path/${pathname}`,
      undefined,
      'getEncryptedArticleByPathWithToken',
      { Authorization: `Bearer ${verifyByPath.token}` },
    );

    return articleByPath as unknown as ArticleDetail;
  }

  async getArticleViewer(id: number | string): Promise<PageViewData> {
    const response = await apiClient.get<{
      statusCode: number;
      data: {
        articleId: number;
        title: string;
        views: number;
        uniqueVisitors: number;
        avgReadTime: number;
      } | null;
    }>(`/api/v2/analytics/public/article/${id}`, undefined, 'getArticleViewer');
    const stats = response.data;
    return {
      visited: stats?.views ?? 0,
      viewer: stats?.uniqueVisitors ?? 0,
    };
  }

  // Timeline, Categories and Tags
  async getTimeline(): Promise<Record<string, Article[]>> {
    const response = await apiClient.get<{ statusCode: number; data: Record<string, Article[]> }>(
      '/api/v2/public/timeline',
      {},
      'getTimeline',
    );
    return response.data;
  }

  async getCategories(): Promise<Record<string, Article[]>> {
    const response = await apiClient.get<{ statusCode: number; data: Record<string, Article[]> }>(
      '/api/v2/public/category',
      {},
      'getCategories',
    );
    return response.data;
  }

  async getTags(): Promise<Record<string, Article[]>> {
    const response = await apiClient.get<{ statusCode: number; data: Record<string, Article[]> }>(
      '/api/v2/public/tag',
      {},
      'getTags',
    );
    return response.data;
  }

  async getArticlesByTag(tag: string): Promise<Article[]> {
    const response = await apiClient.get<{ statusCode: number; data: Article[] }>(
      `/api/v2/public/tag/${tag}`,
      {},
      'getArticlesByTag',
    );
    return response.data;
  }

  // Search
  async searchArticles(keyword: string): Promise<ArticleResponse> {
    const response = await apiClient.get<{ statusCode: number; data: ArticleResponse }>(
      '/api/v2/public/search',
      { value: keyword },
      'searchArticles',
    );
    return response.data;
  }

  // Meta
  async getMeta(): Promise<PublicMetaProp> {
    const response = await apiClient.get<{ statusCode: number; data: PublicMetaProp }>(
      '/api/v2/public/meta',
      {},
      'getMeta',
    );
    return response.data;
  }

  // Page Views
  async getPageView(): Promise<PageViewData> {
    const response = await apiClient.get<{
      statusCode: number;
      data: { totalPageviews: number; totalVisitors: number };
    }>('/api/v2/analytics/public/overview', undefined, 'getPageView');
    const overview = response.data ?? { totalPageviews: 0, totalVisitors: 0 };
    return {
      visited: Number(overview.totalPageviews) || 0,
      viewer: Number(overview.totalVisitors) || 0,
    };
  }

  async updatePageView(_options: { isNew: boolean; isNewByPath: boolean }): Promise<PageViewData> {
    // prevent unused param lint error while keeping signature for compatibility
    void _options;
    // Record a pageview event, then fetch latest overview
    try {
      const path = typeof window !== 'undefined' ? window.location?.pathname : undefined;
      const referrer = typeof document !== 'undefined' ? document.referrer || undefined : undefined;

      // Fire-and-forget record, server may return empty body
      await apiClient.post<void>(
        '/api/v2/analytics/record',
        {
          type: 'pageview',
          path,
          referrer,
        },
        'updatePageView',
      );
    } catch (e) {
      // Swallow record errors; we'll still attempt to get overview as fallback
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[ApiService] updatePageView record failed, will fallback to overview', e);
      }
    }

    // Always return the latest overview mapping to keep contract stable
    return this.getPageView();
  }

  // Custom Pages
  async getAllCustomPages(): Promise<CustomPageList[]> {
    const response = await apiClient.get<{ statusCode: number; data: CustomPageList[] }>(
      '/api/v2/public/customPage/all',
      {},
      'getAllCustomPages',
    );
    return response.data;
  }

  async getCustomPage(path: string): Promise<CustomPage> {
    const response = await apiClient.get<{ statusCode: number; data: CustomPage }>(
      '/api/v2/public/customPage',
      { path },
      'getCustomPage',
    );
    return response.data;
  }
}

// Export a singleton instance
export const apiService = ApiService.getInstance();
