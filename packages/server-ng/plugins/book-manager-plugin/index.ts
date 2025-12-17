/**
 * Book Manager Plugin
 *
 * 📚 v2.0 Plugin API 示例插件
 *
 * 演示功能：
 * - ✅ 数据库访问（api.db, api.table, api.coreTable）
 * - ✅ 依赖注入（api.inject）
 * - ✅ 插件间通信（api.exposeAPI）
 * - ✅ Hook 系统（api.filter, api.action）
 * - ✅ Shortcode 系统（api.shortcode）
 * - ✅ 配置管理（api.config）
 * - ✅ 响应式存储（api.store）
 */

import { desc } from 'drizzle-orm';
import { z } from 'zod';

import { ConfigService } from '../../src/config/config.service';

import type { PluginAPI } from '@vanblog/shared/plugin';

// ============================================================
// 数据模型定义
// ============================================================

/**
 * Book Schema (Zod)
 *
 * 用于运行时验证和动态表创建
 */
const BookSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(200),
  author: z.string().min(1).max(100),
  isbn: z.string().optional(),
  publishedYear: z.number().int().min(1000).max(9999).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  rating: z.number().min(0).max(5).optional(),
});

type Book = z.infer<typeof BookSchema>;

// ============================================================
// 插件主函数
// ============================================================

export default (api: PluginAPI) => {
  api.log.info('Book Manager Plugin v2.0 initializing...');

  // 读取配置
  const enabled = api.config.enabled as boolean;
  const maxBooksPerAuthor = api.config.maxBooksPerAuthor as number;

  if (!enabled) {
    api.log.warn('Plugin is disabled');
    return;
  }

  api.log.info(`Max books per author: ${maxBooksPerAuthor}`);

  // ============================================================
  // 1. 数据库访问 - 创建插件专属表
  // ============================================================

  let bookTable: any;

  try {
    // 使用 Zod Schema 创建 Drizzle 表
    // 表名会自动加前缀：plugin_book-manager-plugin_books
    bookTable = api.table('books', BookSchema);
    api.log.info('Book table created/loaded successfully');
  } catch (error) {
    api.log.error('Failed to create book table', error);
    return;
  }

  // ============================================================
  // 2. 响应式存储 - 统计信息
  // ============================================================

  const stats = api.store('stats', {
    totalBooks: 0,
    totalAuthors: 0,
    lastUpdate: new Date().toISOString(),
  });

  // ============================================================
  // 3. 依赖注入 - 获取 ConfigService
  // ============================================================

  try {
    const configService = api.inject(ConfigService);
    const dbUrl = configService.get('DATABASE_URL');
    api.log.debug(`Database URL: ${dbUrl}`);
  } catch (error) {
    api.log.warn('Failed to inject ConfigService', error);
  }

  // ============================================================
  // 4. 插件间通信 - 暴露 Book API
  // ============================================================

  const BookAPI = {
    /**
     * 搜索图书
     */
    search: async (query: string): Promise<Book[]> => {
      try {
        // 简单的标题搜索
        const books = await api.db.select().from(bookTable);

        return books.filter((book: Book) => book.title.toLowerCase().includes(query.toLowerCase()));
      } catch (error) {
        api.log.error('Search failed', error);
        return [];
      }
    },

    /**
     * 按作者查询图书
     */
    getByAuthor: async (author: string): Promise<Book[]> => {
      try {
        const books = await api.db.select().from(bookTable);
        return books.filter((book: Book) => book.author === author);
      } catch (error) {
        api.log.error('Get by author failed', error);
        return [];
      }
    },

    /**
     * 添加图书
     */
    addBook: async (book: Omit<Book, 'id'>): Promise<Book | null> => {
      try {
        // 检查作者的图书数量限制
        const authorBooks = await BookAPI.getByAuthor(book.author);
        if (authorBooks.length >= maxBooksPerAuthor) {
          api.log.warn(`Author ${book.author} has reached max books limit`);
          return null;
        }

        const result = await api.db.insert(bookTable).values(book).returning();

        // 更新统计
        stats.value.totalBooks += 1;
        stats.value.lastUpdate = new Date().toISOString();

        api.log.info(`Book added: ${book.title}`);
        return result[0] as Book;
      } catch (error) {
        api.log.error('Add book failed', error);
        return null;
      }
    },

    /**
     * 获取推荐图书（评分最高的）
     */
    getRecommendations: async (limit: number = 5): Promise<Book[]> => {
      try {
        const books = await api.db.select().from(bookTable);

        return books
          .filter((book: Book) => book.rating && book.rating >= 4)
          .sort((a: Book, b: Book) => (b.rating || 0) - (a.rating || 0))
          .slice(0, limit);
      } catch (error) {
        api.log.error('Get recommendations failed', error);
        return [];
      }
    },
  };

  // 暴露 API 给其他插件使用
  api.exposeAPI('book', BookAPI);
  api.log.info('Book API exposed to other plugins');

  // ============================================================
  // 5. Hook 系统 - 文章创建时自动检查图书引用
  // ============================================================

  /**
   * Filter: 文章创建前
   *
   * 检查文章内容中是否引用了图书，自动添加标签
   */
  api.filter('article.beforeCreate', async (article: any) => {
    try {
      const { content } = article;

      // 检查是否包含 [book:isbn] 格式的图书引用
      const bookReferences = content.match(/\[book:([^\]]+)\]/g);

      if (bookReferences && bookReferences.length > 0) {
        // 添加 "book-review" 标签
        const tags = article.tags || [];
        if (!tags.includes('book-review')) {
          tags.push('book-review');
        }

        api.log.info(`Article references ${bookReferences.length} books`);

        return {
          ...article,
          tags,
        };
      }
    } catch (error) {
      api.log.error('Failed to process article', error);
    }

    return article;
  });

  /**
   * Action: 文章创建后
   *
   * 记录包含图书引用的文章
   */
  api.action('article.afterCreate', async (article: any) => {
    const { content } = article;
    const bookReferences = content.match(/\[book:([^\]]+)\]/g);

    if (bookReferences) {
      api.log.info(
        `Article "${article.title}" (ID: ${article.id}) contains ${bookReferences.length} book references`,
      );
    }
  });

  // ============================================================
  // 6. Shortcode 系统 - [book] shortcode
  // ============================================================

  /**
   * Shortcode: [book isbn="xxx"]
   *
   * 在文章中嵌入图书信息卡片
   */
  api.shortcode('book', async (attrs) => {
    const isbn = attrs.isbn || attrs.id;

    if (!isbn) {
      return '<div class="book-error">Error: Missing ISBN or ID</div>';
    }

    try {
      // 查询图书
      const books = await api.db.select().from(bookTable);
      const book = books.find((b: Book) => b.isbn === isbn);

      if (!book) {
        return `<div class="book-error">Book not found: ${isbn}</div>`;
      }

      // 生成图书卡片 HTML
      return `
        <div class="book-card">
          <h3 class="book-title">${book.title}</h3>
          <p class="book-author">by ${book.author}</p>
          ${book.publishedYear ? `<p class="book-year">${book.publishedYear}</p>` : ''}
          ${book.rating ? `<p class="book-rating">⭐ ${book.rating}/5</p>` : ''}
          ${book.description ? `<p class="book-description">${book.description}</p>` : ''}
          ${book.tags && book.tags.length > 0 ? `<p class="book-tags">Tags: ${book.tags.join(', ')}</p>` : ''}
        </div>
      `;
    } catch (error) {
      api.log.error('Shortcode failed', error);
      return '<div class="book-error">Failed to load book information</div>';
    }
  });

  // ============================================================
  // 7. 公共数据 - 暴露统计信息给前端
  // ============================================================

  api.provide('bookStats', async () => {
    try {
      const books = await api.db.select().from(bookTable);
      const authors = new Set(books.map((book: Book) => book.author));

      return {
        totalBooks: books.length,
        totalAuthors: authors.size,
        recentBooks: books
          .sort(
            (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )
          .slice(0, 5)
          .map((book: Book) => ({
            title: book.title,
            author: book.author,
            rating: book.rating,
          })),
      };
    } catch (error) {
      api.log.error('Failed to generate book stats', error);
      return {
        totalBooks: 0,
        totalAuthors: 0,
        recentBooks: [],
      };
    }
  });

  // ============================================================
  // 8. 配置变更监听
  // ============================================================

  api.onConfigChange('maxBooksPerAuthor', (newValue) => {
    api.log.info(`Max books per author changed to: ${newValue}`);
  });

  // ============================================================
  // 9. 生命周期钩子
  // ============================================================

  api.onActivate(async () => {
    api.log.info('Book Manager Plugin activated');

    // 初始化统计
    try {
      const books = await api.db.select().from(bookTable);
      const authors = new Set(books.map((book: Book) => book.author));

      stats.value.totalBooks = books.length;
      stats.value.totalAuthors = authors.size;
      stats.value.lastUpdate = new Date().toISOString();

      api.log.info(`Loaded ${books.length} books from ${authors.size} authors`);
    } catch (error) {
      api.log.warn('Failed to initialize stats', error);
    }
  });

  api.onDeactivate(() => {
    api.log.info('Book Manager Plugin deactivated');
  });

  // ============================================================
  // 10. 访问核心表（只读）- 示例
  // ============================================================

  try {
    // 获取核心的 articles 表
    const articlesTable = api.coreTable('articles');

    // 查询最近的文章（只读访问）
    api.db
      .select()
      .from(articlesTable)
      .orderBy(desc(articlesTable.createdAt))
      .limit(5)
      .then((articles: any) => {
        api.log.info(`Found ${articles.length} recent articles`);
      })
      .catch((error: any) => {
        api.log.error('Failed to query articles', error);
      });
  } catch (error) {
    api.log.error('Failed to access core tables', error);
  }

  api.log.info('Book Manager Plugin v2.0 initialized successfully! 🎉');
};
