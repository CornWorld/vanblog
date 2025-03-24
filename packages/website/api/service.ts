import { apiClient } from './client';
import {
  ArticleResponse,
  ArticleDetail,
  PublicMetaProp,
  CustomPageList,
  CustomPage,
} from '../types/api';
import { Article } from '../types/article';
import { PageViewData } from './types';

/**
 * Comprehensive API service for VanBlog public API
 * Based on the following endpoints:
 * - GET /api/public/article
 * - GET /api/public/article/{id}
 * - POST /api/public/article/{id}
 * - GET /api/public/article/viewer/{id}
 * - GET /api/public/search
 * - GET /api/public/timeline
 * - GET /api/public/category
 * - GET /api/public/tag
 * - GET /api/public/tag/{name}
 * - GET /api/public/meta
 * - GET /api/public/viewer
 * - POST /api/public/viewer
 * - GET /api/public/customPage/all
 * - GET /api/public/customPage
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

  invalidateCache(endpoint: string, params?: Record<string, unknown>): void {
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
      const response = await apiClient.get<{
        statusCode: number;
        data: { articles: Article[]; total: number };
      }>('/api/public/article', options, 'getArticles');

      // Validate response structure
      if (!response) {
        console.error('[ApiService] getArticles response is null or undefined');
        throw new Error('Invalid response from API');
      }

      if (!response.data) {
        console.error('[ApiService] getArticles response missing data:', response);
        throw new Error('Invalid response data structure');
      }

      // Check if response has nested articles structure
      if (response.data.articles) {
        console.log(
          `[ApiService] getArticles successfully retrieved ${
            Array.isArray(response.data.articles) ? response.data.articles.length : 'unknown'
          } articles`,
        );

        // Transform to expected ArticleResponse format
        const result: ArticleResponse = {
          data: response.data.articles,
          total: response.data.total,
          page: options.page || 1,
          pageSize: options.pageSize || 10,
        };
        return result;
      }

      // If response doesn't have the nested structure, assume it's already
      // in the correct format (but this should not happen)
      console.warn('[ApiService] Response does not have expected structure with articles property');
      return response.data as unknown as ArticleResponse;
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
      }>(`/api/public/article/${idOrPathname}`, {}, 'getArticleByIdOrPathname');

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
        id: '0',
        title: 'Error Loading Article',
        content: 'There was an error loading this article. Please try again later.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        category: '',
        tags: [],
        private: false,
        top: 0,
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
    const response = await apiClient.post<{ statusCode: number; data: ArticleDetail }>(
      `/api/public/article/${idOrPathname}`,
      { password },
      'getEncryptedArticle',
    );
    return response.data;
  }

  async getArticleViewer(id: number | string): Promise<PageViewData> {
    const response = await apiClient.get<{ statusCode: number; data: PageViewData }>(
      `/api/public/article/viewer/${id}`,
      undefined,
      'getArticleViewer',
    );
    return response.data;
  }

  // Timeline, Categories and Tags
  async getTimeline(): Promise<Record<string, Article[]>> {
    const response = await apiClient.get<{ statusCode: number; data: Record<string, Article[]> }>(
      '/api/public/timeline',
      {},
      'getTimeline',
    );
    return response.data;
  }

  async getCategories(): Promise<Record<string, Article[]>> {
    const response = await apiClient.get<{ statusCode: number; data: Record<string, Article[]> }>(
      '/api/public/category',
      {},
      'getCategories',
    );
    return response.data;
  }

  async getTags(): Promise<Record<string, Article[]>> {
    const response = await apiClient.get<{ statusCode: number; data: Record<string, Article[]> }>(
      '/api/public/tag',
      {},
      'getTags',
    );
    return response.data;
  }

  async getArticlesByTag(tag: string): Promise<Article[]> {
    const response = await apiClient.get<{ statusCode: number; data: Article[] }>(
      `/api/public/tag/${tag}`,
      {},
      'getArticlesByTag',
    );
    return response.data;
  }

  // Search
  async searchArticles(keyword: string): Promise<ArticleResponse> {
    const response = await apiClient.get<{ statusCode: number; data: ArticleResponse }>(
      '/api/public/search',
      { value: keyword },
      'searchArticles',
    );
    return response.data;
  }

  // Meta
  async getMeta(): Promise<PublicMetaProp> {
    const response = await apiClient.get<{ statusCode: number; data: PublicMetaProp }>(
      '/api/public/meta',
      {},
      'getMeta',
    );
    return response.data;
  }

  // Page Views
  async getPageView(): Promise<PageViewData> {
    const response = await apiClient.get<{ statusCode: number; data: PageViewData }>(
      '/api/public/viewer',
      undefined,
      'getPageView',
    );
    return response.data;
  }

  async updatePageView(options: { isNew: boolean; isNewByPath: boolean }): Promise<PageViewData> {
    const response = await apiClient.post<{ statusCode: number; data: PageViewData }>(
      '/api/public/viewer',
      options,
      'updatePageView',
    );
    return response.data;
  }

  // Custom Pages
  async getAllCustomPages(): Promise<CustomPageList[]> {
    const response = await apiClient.get<{ statusCode: number; data: CustomPageList[] }>(
      '/api/public/customPage/all',
      {},
      'getAllCustomPages',
    );
    return response.data;
  }

  async getCustomPage(path: string): Promise<CustomPage> {
    const response = await apiClient.get<{ statusCode: number; data: CustomPage }>(
      '/api/public/customPage',
      { path },
      'getCustomPage',
    );
    return response.data;
  }
}

// Export a singleton instance
export const apiService = ApiService.getInstance();
