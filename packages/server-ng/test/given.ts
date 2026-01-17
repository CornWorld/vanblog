/**
 * Given - 测试数据快速创建工具
 *
 * 一行代码创建测试数据，无需关心格式、外键、事务
 *
 * @example
 * import { Given } from '@test/given';
 *
 * // 创建文章（自动创建 user 和 category 依赖）
 * await Given.article({ title: 'Test' });
 *
 * // 批量创建
 * await Given.articles(10);
 */

import { db } from './setup.unit';
import {
  articles,
  users,
  categories,
  tags,
  articleTags,
  draftTags,
  drafts,
  staticFiles,
  analytics,
  webhooks,
  permissionGroups,
  draftVersions,
} from '@vanblog/shared/drizzle';
import { eq } from 'drizzle-orm';
import { Mock } from './mock';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';

type TestDatabase = LibSQLDatabase<Record<string, unknown>>;

/**
 * ID 生成器 - 为测试数据生成唯一 ID
 * 使用时间戳 + 随机数确保唯一性
 */
function generateUniqueId(prefix: string = ''): number {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return parseInt(`${prefix}${String(timestamp)}${String(random)}`.slice(-10)); // 保留最后10位作为 ID
}

export class Given {
  /**
   * 创建文章测试数据
   *
   * 自动处理外键依赖（User、Category），无需手动创建关联数据。
   * 支持自定义字段覆盖，所有未指定字段使用 Mock 默认值。
   *
   * **UPDATED**: 接受 db/tx 作为第一个参数，支持 afterEach cleanup 测试策略
   *
   * @param dbOrTx - 数据库或事务实例（可选，默认使用 db）
   * @param overrides - 要覆盖的字段（Partial<Article>），可选
   * @returns 创建的文章对象（包含数据库生成的字段）
   *
   * @example
   * // 使用默认值创建文章（直接提交到 db）
   * const article = await Given.article(db);
   *
   * @example
   * // 在测试事务中使用
   * await withTestTransaction(db, async (tx) => {
   *   const service = new ArticleService(tx);
   *   const article = await Given.article(tx, { title: 'Test' });
   *   const result = await service.findOne(article.id);
   *   expect(result).toBeDefined(); // ✅ 数据可见
   * });
   *
   * @example
   * // 使用 afterEach cleanup 策略（推荐用于复杂查询）
   * afterEach(async () => { await cleanupTestData(db); });
   * it('test', async () => {
   *   const article = await Given.article(db, {
   *     title: 'My Test Article',
   *     category: 'Technology'
   * });
   *
   * 自动处理功能：
   * - User 依赖：如果指定的 author 不存在，自动创建用户
   * - Category 依赖：如果指定的 category 不存在，自动创建分类
   * - 字段格式：tags 自动转为 JSON 字符串（Drizzle mode: 'json' 自动处理）
   * - 错误处理：捕获并抛出详细的错误信息
   */
  static async article(
    dbOrTx: TestDatabase = db as TestDatabase,
    overrides: Partial<any> = {},
  ): Promise<any> {
    const executeInsert = async (tx: TestDatabase) => {
      try {
        // 自动创建依赖的 user
        const authorId = String(overrides.author || '1');
        const existingUser = await tx
          .select()
          .from(users)
          .where(eq(users.id, Number(authorId)))
          .get();

        if (!existingUser) {
          await (tx as any).insert(users).values({
            id: Number(authorId),
            username: `user${authorId}`,
            name: `User ${authorId}`,
            email: `user${authorId}@example.com`,
            type: 'admin',
            password: 'hashed-password',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        // 自动创建依赖的 category（如果提供了 category）
        const mock = Mock.article();
        const categoryName = overrides.category || mock.category;
        if (categoryName) {
          const existingCategory = await tx
            .select()
            .from(categories)
            .where(eq(categories.name, String(categoryName)))
            .get();

          if (!existingCategory) {
            await (tx as any).insert(categories).values({
              name: String(categoryName),
              slug: String(categoryName).toLowerCase(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        }

        // 处理 tags 字段：确保是数组格式
        // Drizzle mode: 'json' 会自动序列化为 JSON 字符串存储到数据库
        let tagsValue: string[] = [];
        if (overrides.tags !== undefined) {
          // 如果用户提供了 tags，使用用户的值（确保是数组）
          tagsValue = Array.isArray(overrides.tags) ? overrides.tags : [overrides.tags];
        } else if (typeof mock.tags === 'string') {
          // 如果 mock 返回的是 JSON 字符串，解析为数组
          try {
            tagsValue = JSON.parse(mock.tags);
          } catch {
            // 解析失败，使用默认值
            tagsValue = ['test'];
          }
        } else if (Array.isArray(mock.tags)) {
          tagsValue = mock.tags;
        }

        // 构建 article 值对象（排除 author 和 category，后面单独处理以避免重复）
        const { author: _author, category: _category, ...restOverrides } = overrides;

        // 生成唯一 ID 和 pathname 以避免 PRIMARY KEY 和 UNIQUE 约束冲突
        const uniqueId = restOverrides.id !== undefined ? restOverrides.id : generateUniqueId('1');
        const uniquePathname =
          restOverrides.pathname !== undefined
            ? restOverrides.pathname
            : `/article-${String(uniqueId)}`;

        // 先应用 overrides,然后确保 id 和 pathname 是唯一的
        // NOTE: tags 字段不再写入 articles 表（已迁移到 article_tags 关联表）
        const articleData = {
          ...mock,
          ...restOverrides,
          id: uniqueId, // 最后设置 id,确保唯一性
          pathname: uniquePathname, // 最后设置 pathname,确保唯一性
          tags: null, // 不再使用 JSON 字段存储 tags
          category: categoryName, // 使用已验证存在的 category
          author: authorId, // 使用已验证存在的 author
        };

        const [article] = await (tx as any).insert(articles).values(articleData).returning();

        // 插入标签关联到 article_tags 表
        if (tagsValue.length > 0) {
          // 先确保所有标签存在
          for (const tagName of tagsValue) {
            const existingTag = await tx.select().from(tags).where(eq(tags.name, tagName)).get();
            if (!existingTag) {
              await (tx as any).insert(tags).values({
                name: tagName,
                slug: tagName.toLowerCase().replace(/\s+/g, '-'),
                createdAt: new Date().toISOString(),
              });
            }
          }

          // 插入文章-标签关联
          await (tx as any).insert(articleTags).values(
            tagsValue.map((tagName) => ({
              articleId: article.id,
              tagName,
              createdAt: new Date().toISOString(),
            })),
          );
        }

        return article;
      } catch (error) {
        throw new Error(
          `Failed to create article: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };

    return executeInsert(dbOrTx);
  }

  /**
   * 创建用户测试数据
   *
   * 使用 Mock 生成默认用户数据，支持字段覆盖。
   *
   * @param dbOrTx - 数据库或事务实例（可选，默认使用 db）
   * @param overrides - 要覆盖的字段（Partial<User>），可选
   * @returns 创建的用户对象（包含数据库生成的字段）
   *
   * @example
   * // 使用默认值创建用户
   * const user = await Given.user(db);
   *
   * @example
   * // 创建管理员用户
   * const admin = await Given.user(db, {
   *   username: 'admin',
   *   name: 'Administrator',
   *   type: 'admin'
   * });
   *
   * @example
   * // 创建访客用户
   * const guest = await Given.user(db, {
   *   username: 'guest',
   *   type: 'guest',
   *   email: 'guest@example.com'
   * });
   *
   * 自动处理功能：
   * - 字段默认值：未指定的字段使用 Mock 生成的合理默认值
   * - 时间戳：自动生成 createdAt 和 updatedAt
   */
  static async user(
    dbOrTx: TestDatabase = db as TestDatabase,
    overrides: Partial<any> = {},
  ): Promise<any> {
    const executeInsert = async (tx: TestDatabase) => {
      const mock = Mock.user();
      const [user] = await (tx as any)
        .insert(users)
        .values({
          id: overrides.id || generateUniqueId('1'), // 使用唯一 ID 而非固定 mock.id
          username: overrides.username || mock.username,
          name: overrides.name || mock.name,
          email: overrides.email || mock.email,
          type: overrides.type || mock.type,
          password: overrides.password || mock.password,
          createdAt: mock.createdAt,
          updatedAt: mock.updatedAt,
          ...overrides,
        })
        .returning();
      return user;
    };

    return executeInsert(dbOrTx);
  }

  /**
   * 创建分类测试数据
   *
   * 使用 Mock 生成默认分类数据，支持字段覆盖。
   *
   * @param dbOrTx - 数据库或事务实例（可选，默认使用 db）
   * @param overrides - 要覆盖的字段（Partial<Category>），可选
   * @returns 创建的分类对象（包含数据库生成的字段）
   *
   * @example
   * // 使用默认值创建分类
   * const category = await Given.category(db);
   *
   * @example
   * // 创建技术分类
   * const techCategory = await Given.category(db, {
   *   name: 'Technology',
   *   slug: 'tech'
   * });
   *
   * @example
   * // 创建生活分类
   * const lifeCategory = await Given.category(db, {
   *   name: 'Life',
   *   slug: 'life'
   * });
   *
   * 自动处理功能：
   * - 字段默认值：未指定的字段使用 Mock 生成的合理默认值
   * - 时间戳：自动生成 createdAt 和 updatedAt
   * - 唯一性：自动生成唯一 name 避免 UNIQUE 约束冲突
   */
  static async category(
    dbOrTx: TestDatabase = db as TestDatabase,
    overrides: Partial<any> = {},
  ): Promise<any> {
    const executeInsert = async (tx: TestDatabase) => {
      const mock = Mock.category(overrides);

      // 生成唯一的 category name、slug 和 id 以避免 UNIQUE 约束冲突
      const uniqueSuffix = Math.random().toString(36).substring(7);
      const uniqueName = overrides.name || `${String(mock.name)}-${uniqueSuffix}`;
      const uniqueId = overrides.id !== undefined ? overrides.id : generateUniqueId('3');
      const uniqueSlug = overrides.slug || `${String(mock.slug)}-${uniqueSuffix}`;

      // 构建数据对象，确保 id、name 和 slug 是唯一的
      const categoryData = {
        ...mock,
        id: uniqueId, // 使用唯一 ID
        name: uniqueName, // 使用唯一 name
        slug: uniqueSlug, // 使用唯一 slug
        createdAt: mock.createdAt,
        updatedAt: mock.updatedAt,
      };

      const [category] = await (tx as any).insert(categories).values(categoryData).returning();
      return category;
    };

    return executeInsert(dbOrTx);
  }

  /**
   * 批量创建文章（性能优化：使用事务批量插入）
   *
   * 创建指定数量的文章，每篇文章都会自动处理 User 和 Category 依赖。
   * 所有文章在同一测试事务中创建，测试结束后自动回滚。
   *
   * 性能优化：
   * - 使用单次批量插入（INSERT INTO ... VALUES (...), (...), ...) 替代循环插入
   * - 依赖检查仅执行一次（User 和 Category）
   * - 避免多次数据库往返，性能提升约 10-100 倍
   *
   * @param count - 要创建的文章数量（必须大于 0）
   * @param overrides - 应用于所有文章的字段覆盖（Partial<Article>），可选
   * @returns 创建的文章数组（长度等于 count）
   *
   * @example
   * // 创建 10 篇默认文章
   * const articles = await Given.articles(10);
   *
   * @example
   * // 创建 5 篇技术类文章（自动创建 Technology 分类）
   * const techArticles = await Given.articles(5, {
   *   category: 'Technology'
   * });
   *
   * @example
   * // 创建 3 篇私密文章
   * const privateArticles = await Given.articles(3, {
   *   private: true,
   *   password: 'secret'
   * });
   *
   * @example
   * // 创建置顶文章
   * const pinnedArticles = await Given.articles(2, {
   *   top: true
   * });
   *
   * 自动处理功能：
   * - User 依赖：自动创建所需用户（仅查询一次）
   * - Category 依赖：自动创建所需分类（仅查询一次）
   * - 事务管理：所有文章在同一事务中创建，测试结束自动回滚
   * - ID 递增：文章 ID 从 1 开始递增（1, 2, 3, ...）
   * - 字段覆盖：overrides 参数应用于所有文章
   */
  static async articles(
    dbOrTx: TestDatabase | number = db as TestDatabase,
    countOrOverrides?: number | Partial<any>,
    maybeOverrides?: Partial<any>,
  ): Promise<any[]> {
    // 处理重载：articles(count) 或 articles(dbOrTx, count) 或 articles(dbOrTx, count, overrides)
    let actualDb: TestDatabase;
    let count: number;
    let overrides: Partial<any>;

    if (typeof dbOrTx === 'number') {
      // articles(count, overrides?)
      actualDb = db as TestDatabase;
      count = dbOrTx;
      overrides = (countOrOverrides as Partial<any>) || {};
    } else {
      // articles(dbOrTx, count, overrides?)
      actualDb = dbOrTx as TestDatabase;
      count = (countOrOverrides as number) || 10;
      overrides = maybeOverrides || {};
    }

    const executeInsert = async (tx: TestDatabase) => {
      // 确保依赖的用户存在（只查询一次）
      const authorId = String(overrides.author || 1);
      const existingUser = await tx
        .select()
        .from(users)
        .where(eq(users.id, Number(authorId)))
        .get();
      if (!existingUser) {
        await (tx as any).insert(users).values({
          id: Number(authorId),
          username: `user${authorId}`,
          name: `User ${authorId}`,
          email: `user${authorId}@example.com`,
          type: 'admin',
          password: 'hashed-password',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // 确保依赖的分类存在（只查询一次）
      if (overrides.category) {
        const existingCategory = await tx
          .select()
          .from(categories)
          .where(eq(categories.name, overrides.category))
          .get();
        if (!existingCategory) {
          await (tx as any).insert(categories).values({
            name: overrides.category,
            slug: overrides.category.toLowerCase(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      // 批量生成文章数据
      const articlesData = Array.from({ length: count }, (_, i) => {
        const mock = Mock.article({ id: i + 1, ...overrides });
        return {
          id: mock.id,
          title: overrides.title !== undefined ? overrides.title : mock.title,
          content: mock.content,
          pathname: mock.pathname,
          tags: Array.isArray(mock.tags) ? JSON.stringify(mock.tags) : mock.tags,
          category: overrides.category || mock.category,
          author: authorId,
          top: mock.top,
          hidden: mock.hidden,
          private: overrides.private !== undefined ? overrides.private : mock.private,
          password: mock.password,
          viewer: mock.viewer,
          createdAt: mock.createdAt,
          updatedAt: mock.updatedAt,
          ...overrides,
        };
      });

      // 批量插入（一次性提交所有文章）
      const insertedArticles = await (tx as any).insert(articles).values(articlesData).returning();

      return insertedArticles;
    };

    return executeInsert(actualDb);
  }

  /**
   * 创建标签测试数据
   *
   * 使用 Mock 生成默认标签数据，支持字段覆盖。
   * 在测试事务中执行，测试结束后自动回滚。
   *
   * @param overrides - 要覆盖的字段（Partial<Tag>），可选
   * @returns 创建的标签对象（包含数据库生成的字段）
   *
   * @example
   * // 使用默认值创建标签
   * const tag = await Given.tag();
   *
   * @example
   * // 创建技术标签
   * const techTag = await Given.tag({
   *   name: 'Technology',
   *   slug: 'tech'
   * });
   *
   * @example
   * // 创建标签（不指定 slug）
   * const simpleTag = await Given.tag({
   *   name: 'JavaScript'
   * });
   *
   * 自动处理功能：
   * - 字段默认值：未指定的字段使用 Mock 生成的合理默认值
   * - 时间戳：自动生成 createdAt 和 updatedAt
   */
  static async tag(
    dbOrTx: TestDatabase = db as TestDatabase,
    overrides: Partial<any> = {},
  ): Promise<any> {
    const executeInsert = async (tx: TestDatabase) => {
      const mock = Mock.tag(overrides);

      // 生成唯一的 tag name, slug 和 id 以避免 UNIQUE 约束冲突
      const uniqueSuffix = Math.random().toString(36).substring(7);
      const uniqueName =
        overrides.name !== undefined ? overrides.name : `${String(mock.name)}-${uniqueSuffix}`;
      const uniqueSlug =
        overrides.slug !== undefined ? overrides.slug : `${String(mock.slug)}-${uniqueSuffix}`;
      const uniqueId = overrides.id !== undefined ? overrides.id : generateUniqueId('4');

      // 构建数据对象，确保 id, name 和 slug 是唯一的
      const tagData = {
        ...mock,
        id: uniqueId, // 使用唯一 ID
        name: uniqueName, // 使用唯一 name
        slug: uniqueSlug, // 使用唯一 slug
        createdAt: mock.createdAt,
      };

      const [tag] = await (tx as any).insert(tags).values(tagData).returning();
      return tag;
    };

    return executeInsert(dbOrTx);
  }

  /**
   * 创建管理员用户
   *
   * 快捷方法，创建一个类型为 'admin' 的用户。
   * 在测试事务中执行，测试结束后自动回滚。
   *
   * @param overrides - 要覆盖的字段（Partial<User>），可选
   * @returns 创建的管理员用户对象
   *
   * @example
   * // 使用默认值创建管理员
   * const admin = await Given.adminUser();
   *
   * @example
   * // 创建自定义用户名的管理员
   * const admin = await Given.adminUser({
   *   username: 'superadmin',
   *   name: 'Super Administrator'
   * });
   */
  static async adminUser(
    dbOrTx: TestDatabase = db as TestDatabase,
    overrides: Partial<any> = {},
  ): Promise<any> {
    return Given.user(dbOrTx, {
      type: 'admin',
      ...overrides,
    });
  }

  /**
   * 创建公开文章
   *
   * 快捷方法，创建一篇非私密、非隐藏的文章。
   * 在测试事务中执行，测试结束后自动回滚。
   *
   * @param overrides - 要覆盖的字段（Partial<Article>），可选
   * @returns 创建的公开文章对象
   *
   * @example
   * // 使用默认值创建公开文章
   * const article = await Given.publicArticle();
   *
   * @example
   * // 创建自定义标题的公开文章
   * const article = await Given.publicArticle({
   *   title: 'My Public Post'
   * });
   */
  static async publicArticle(
    dbOrTx: TestDatabase = db as TestDatabase,
    overrides: Partial<any> = {},
  ): Promise<any> {
    return Given.article(dbOrTx, {
      private: false,
      hidden: false,
      ...overrides,
    });
  }

  /**
   * 创建私密文章
   *
   * 快捷方法，创建一篇私密文章（需要密码访问）。
   * 在测试事务中执行，测试结束后自动回滚。
   *
   * @param overrides - 要覆盖的字段（Partial<Article>），可选
   * @returns 创建的私密文章对象
   *
   * @example
   * // 使用默认密码创建私密文章
   * const article = await Given.privateArticle();
   *
   * @example
   * // 创建自定义密码的私密文章
   * const article = await Given.privateArticle({
   *   title: 'Secret Post',
   *   password: 'mySecret123'
   * });
   */
  static async privateArticle(
    dbOrTx: TestDatabase = db as TestDatabase,
    overrides: Partial<any> = {},
  ): Promise<any> {
    return Given.article(dbOrTx, {
      private: true,
      password: 'secret123',
      ...overrides,
    });
  }

  /**
   * 创建已发布文章
   *
   * 快捷方法，创建一篇非隐藏的已发布文章。
   * 在测试事务中执行，测试结束后自动回滚。
   *
   * @param overrides - 要覆盖的字段（Partial<Article>），可选
   * @returns 创建的已发布文章对象
   *
   * @example
   * // 使用默认值创建已发布文章
   * const article = await Given.publishedArticle();
   *
   * @example
   * // 创建自定义标题的已发布文章
   * const article = await Given.publishedArticle({
   *   title: 'Published Post'
   * });
   */
  static async publishedArticle(
    dbOrTx: TestDatabase = db as TestDatabase,
    overrides: Partial<any> = {},
  ): Promise<any> {
    return Given.article(dbOrTx, {
      hidden: false,
      ...overrides,
    });
  }

  /**
   * 创建草稿测试数据
   *
   * 使用 Mock 生成默认草稿数据，支持字段覆盖。
   * 自动处理文章内容相关字段（如 tags 自动转为 JSON）。
   * 在测试事务中执行，测试结束后自动回滚。
   *
   * @param overrides - 要覆盖的字段（Partial<Draft>），可选
   * @returns 创建的草稿对象（包含数据库生成的字段）
   *
   * @example
   * // 使用默认值创建草稿
   * const draft = await Given.draft();
   *
   * @example
   * // 创建自定义标题的草稿
   * const draft = await Given.draft({
   *   title: 'My Custom Draft',
   *   content: 'Draft content here'
   * });
   *
   * @example
   * // 创建带标签的草稿
   * const draft = await Given.draft({
   *   title: 'Tagged Draft',
   *   tags: ['javascript', 'typescript']
   * });
   *
   * @example
   * // 创建带分类的草稿
   * const draft = await Given.draft({
   *   title: 'Tech Draft',
   *   category: 'Technology'
   * });
   *
   * 自动处理功能：
   * - 事务管理：在测试事务中执行，测试结束自动回滚
   * - 字段格式：tags 自动转为 JSON 格式（SQLite JSON mode）
   * - 字段默认值：未指定的字段使用 Mock 生成的合理默认值
   * - 时间戳：自动生成 createdAt 和 updatedAt
   * - 版本号：自动设置默认版本号（version: 1）
   */
  static async draft(
    dbOrTx: TestDatabase = db as TestDatabase,
    overrides: Partial<any> = {},
  ): Promise<any> {
    const executeInsert = async (tx: TestDatabase) => {
      // 创建 Mock 数据
      const mock = Mock.draft();

      // 处理 tags 字段：确保是数组格式
      let tagsValue: string[] = [];
      if (overrides.tags !== undefined) {
        // 如果用户提供了 tags，使用用户的值（确保是数组）
        tagsValue = Array.isArray(overrides.tags) ? overrides.tags : [overrides.tags];
      } else if (typeof mock.tags === 'string') {
        // 如果 mock 返回的是 JSON 字符串，解析为数组
        try {
          tagsValue = JSON.parse(mock.tags);
        } catch {
          // 解析失败，使用默认值
          tagsValue = ['test'];
        }
      } else if (Array.isArray(mock.tags)) {
        tagsValue = mock.tags;
      }

      // 处理草稿数据
      // 生成唯一 ID 和 pathname 以避免 PRIMARY KEY 和 UNIQUE 约束冲突
      const uniqueId = overrides.id !== undefined ? overrides.id : generateUniqueId('2');
      const uniquePathname =
        overrides.pathname !== undefined ? overrides.pathname : `/draft-${String(uniqueId)}`;

      // 先应用 overrides,然后确保 id 和 pathname 是唯一的
      // NOTE: tags 字段不再写入 drafts 表（已迁移到 draft_tags 关联表）
      const draftData = {
        ...mock,
        ...overrides,
        id: uniqueId, // 最后设置 id,确保唯一性
        pathname: uniquePathname, // 最后设置 pathname,确保唯一性
        tags: null, // 不再使用 JSON 字段存储 tags
      };

      // 插入草稿
      const [draft] = await (tx as any).insert(drafts).values(draftData).returning();

      // 插入标签关联到 draft_tags 表
      if (tagsValue.length > 0) {
        // 过滤掉 null/undefined 值
        const validTagNames = tagsValue.filter((tagName) => tagName != null);

        if (validTagNames.length > 0) {
          // 先确保所有标签存在
          for (const tagName of validTagNames) {
            const existingTag = await tx.select().from(tags).where(eq(tags.name, tagName)).get();
            if (!existingTag) {
              await (tx as any).insert(tags).values({
                name: tagName,
                slug: tagName.toLowerCase().replace(/\s+/g, '-'),
                createdAt: new Date().toISOString(),
              });
            }
          }

          // 插入草稿-标签关联
          await (tx as any).insert(draftTags).values(
            validTagNames.map((tagName) => ({
              draftId: draft.id,
              tagName,
              createdAt: new Date().toISOString(),
            })),
          );
        }
      }

      return draft;
    };

    return executeInsert(dbOrTx);
  }

  /**
   * 创建媒体文件测试数据
   *
   * 使用 Mock 生成默认媒体文件数据，支持字段覆盖。
   * 在测试事务中执行，测试结束后自动回滚。
   *
   * @param overrides - 要覆盖的字段（Partial<StaticFile>），可选
   * @returns 创建的媒体文件对象（包含数据库生成的字段）
   *
   * @example
   * // 使用默认值创建媒体文件
   * const media = await Given.media();
   *
   * @example
   * // 创建自定义文件名的媒体文件
   * const media = await Given.media({
   *   filename: 'custom-image.jpg',
   *   path: '/uploads/images/custom-image.jpg'
   * });
   *
   * @example
   * // 创建 PNG 图片
   * const media = await Given.media({
   *   filename: 'photo.png',
   *   mimeType: 'image/png',
   *   width: 800,
   *   height: 600
   * });
   *
   * @example
   * // 创建云存储文件
   * const media = await Given.media({
   *   filename: 'remote.pdf',
   *   path: 'https://oss.example.com/bucket/remote.pdf',
   *   provider: 'oss',
   *   size: 2048576
   * });
   *
   * 自动处理功能：
   * - 事务管理：在测试事务中执行，测试结束自动回滚
   * - 字段默认值：未指定的字段使用 Mock 生成的合理默认值
   * - 时间戳：自动生成 createdAt
   */
  static async media(
    dbOrTx: TestDatabase = db as TestDatabase,
    overrides: Partial<any> = {},
  ): Promise<any> {
    const executeInsert = async (tx: TestDatabase) => {
      const mock = Mock.mediaFile();
      const [media] = await (tx as any)
        .insert(staticFiles)
        .values({
          id: mock.id,
          filename: overrides.filename || mock.filename,
          path: overrides.path || mock.path,
          size: overrides.size !== undefined ? overrides.size : mock.size,
          mimeType: overrides.mimeType !== undefined ? overrides.mimeType : mock.mimetype,
          width: overrides.width !== undefined ? overrides.width : mock.width,
          height: overrides.height !== undefined ? overrides.height : mock.height,
          hash: overrides.hash !== undefined ? overrides.hash : mock.hash,
          provider: overrides.provider || mock.provider,
          createdAt: mock.createdAt,
          ...overrides,
        })
        .returning();
      return media;
    };

    return executeInsert(dbOrTx);
  }

  /**
   * 创建评论测试数据
   *
   * 注意：评论由 Waline 管理（外部服务），此方法仅创建测试用的评论对象，不写入本地数据库。
   * 会自动创建依赖的文章（如果不存在）。
   *
   * @param overrides - 要覆盖的字段（Partial<Comment>），可选
   * @returns 评论对象（仅用于测试，不持久化到数据库）
   *
   * @example
   * // 使用默认值创建评论
   * const comment = await Given.comment();
   *
   * @example
   * // 创建自定义评论（自动创建文章 1）
   * const comment = await Given.comment({
   *   author: 'John Doe',
   *   email: 'john@example.com',
   *   content: 'Great article!'
   * });
   *
   * @example
   * // 创建待审核评论
   * const pendingComment = await Given.comment({
   *   status: 'pending',
   *   content: 'This needs moderation'
   * });
   *
   * @example
   * // 创建回复评论
   * const reply = await Given.comment({
   *   articleId: 1,
   *   parentId: 5,
   *   content: 'This is a reply'
   * });
   *
   * 自动处理功能：
   * - Article 依赖：如果指定的 articleId 不存在，自动创建文章
   * - 依赖链处理：自动创建文章所需的 user
   * - 事务管理：依赖数据在测试事务中创建，测试结束自动回滚
   * - 数据返回：返回评论对象用于测试，不写入本地数据库（评论由 Waline 管理）
   */
  static async comment(
    dbOrTx: TestDatabase = db as TestDatabase,
    overrides: Partial<any> = {},
  ): Promise<any> {
    const executeInsert = async (tx: TestDatabase) => {
      // 自动创建依赖的 article
      const articleId = overrides.articleId !== undefined ? overrides.articleId : 1;

      const existingArticle = await tx
        .select()
        .from(articles)
        .where(eq(articles.id, Number(articleId)))
        .get();

      if (!existingArticle) {
        // 创建作者用户
        const authorId = overrides.authorId !== undefined ? overrides.authorId : 1;
        const existingUser = await tx
          .select()
          .from(users)
          .where(eq(users.id, Number(authorId)))
          .get();

        if (!existingUser) {
          await (tx as any).insert(users).values({
            id: Number(authorId),
            username: `user${String(authorId)}`,
            name: `User ${String(authorId)}`,
            email: `user${String(authorId)}@example.com`,
            type: 'admin',
            password: 'hashed-password',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        // 创建文章
        await (tx as any).insert(articles).values({
          id: Number(articleId),
          title: `Article ${String(articleId)}`,
          content: `Content for article ${String(articleId)}`,
          pathname: `article-${String(articleId)}`,
          tags: [],
          author: String(authorId),
          top: 0,
          hidden: false,
          private: false,
          password: null,
          viewer: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // 返回评论对象（不写入数据库，因为评论由 Waline 管理）
      const mock = Mock.comment();
      return {
        id: mock.id,
        articleId: Number(articleId),
        parentId: overrides.parentId !== undefined ? overrides.parentId : null,
        author: overrides.author !== undefined ? overrides.author : mock.author,
        email: overrides.email !== undefined ? overrides.email : mock.email,
        content: overrides.content !== undefined ? overrides.content : mock.content,
        status: overrides.status !== undefined ? overrides.status : mock.status,
        createdAt: mock.createdAt,
        updatedAt: mock.updatedAt,
        ...overrides,
      };
    };

    return executeInsert(dbOrTx);
  }

  /**
   * 创建分析数据测试数据
   *
   * @param overrides - 要覆盖的字段
   * @returns 创建的分析数据对象
   */
  static async analytics(
    dbOrTx: TestDatabase = db as TestDatabase,
    overrides: Partial<any> = {},
  ): Promise<any> {
    const executeInsert = async (tx: TestDatabase) => {
      const mock = Mock.analyticsData();
      const [record] = await (tx as any)
        .insert(analytics)
        .values({
          type: overrides.type || mock.type,
          path: overrides.path || mock.path,
          userAgent: overrides.userAgent || mock.userAgent,
          ip: overrides.ip || mock.ip,
          referrer: overrides.referrer || mock.referrer,
          createdAt: mock.createdAt,
          ...overrides,
        })
        .returning();
      return record;
    };

    return executeInsert(dbOrTx);
  }

  /**
   * 批量创建分析数据
   *
   * @param count - 创建数量
   * @param overrides - 要覆盖的字段
   * @returns 创建的分析数据数组
   */
  static async analyticsList(
    dbOrTx: TestDatabase = db as TestDatabase,
    count: number,
    overrides: Partial<any> = {},
  ): Promise<any[]> {
    const results = [];
    for (let i = 0; i < count; i++) {
      const item = await Given.analytics(dbOrTx, {
        ...overrides,
        ip: overrides.ip || `192.168.1.${String(i)}`,
      });
      results.push(item);
    }
    return results;
  }

  /**
   * 创建Webhook测试数据
   *
   * @param overrides - 要覆盖的字段
   * @returns 创建的Webhook对象
   */
  static async webhook(
    dbOrTx: TestDatabase = db as TestDatabase,
    overrides: Partial<any> = {},
  ): Promise<any> {
    const executeInsert = async (tx: TestDatabase) => {
      const mock = Mock.webhook();

      // 生成唯一的 webhook name 和 id 以避免 UNIQUE 约束冲突
      const uniqueSuffix = Math.random().toString(36).substring(7);
      const uniqueName = overrides.name || `${mock.name}-${uniqueSuffix}`;
      const uniqueId = overrides.id !== undefined ? overrides.id : generateUniqueId('5');

      // 先应用 overrides,然后确保 name 和 id 是唯一的（这样可以保留其他字段的覆盖）
      const webhookData = {
        ...mock,
        ...overrides,
        id: uniqueId, // 最后设置 id,确保唯一性
        name: uniqueName, // 最后设置 name,确保唯一性
      };

      const [webhook] = await (tx as any).insert(webhooks).values(webhookData).returning();
      return webhook;
    };

    return executeInsert(dbOrTx);
  }

  /**
   * 创建权限组测试数据
   *
   * @param overrides - 要覆盖的字段
   * @returns 创建的权限组对象
   */
  static async permissionGroup(
    dbOrTx: TestDatabase = db as TestDatabase,
    overrides: Partial<any> = {},
  ): Promise<any> {
    const executeInsert = async (tx: TestDatabase) => {
      const mock = Mock.permissionGroup();

      // 生成唯一的 permission group name 以避免 UNIQUE 约束冲突
      const uniqueSuffix = Math.random().toString(36).substring(7);
      const uniqueName = overrides.name || `${mock.name}-${uniqueSuffix}`;

      // 移除 mock 和 overrides 中的 id，让 SQLite 自动分配 autoIncrement id
      // 这样避免 PRIMARY KEY 冲突
      const { id: _mockId, ...mockWithoutId } = mock;
      const { id: _overrideId, ...restOverrides } = overrides;

      // 先应用 overrides,然后确保 name 是唯一的
      const groupData = {
        ...mockWithoutId,
        ...restOverrides,
        name: uniqueName, // 最后设置 name,确保唯一性
      };

      const [group] = await (tx as any).insert(permissionGroups).values(groupData).returning();
      return group; // 返回单个对象（Drizzle returning() 返回数组，需要解构）
    };

    return executeInsert(dbOrTx);
  }

  /**
   * 创建草稿版本测试数据
   *
   * @param overrides - 要覆盖的字段
   * @returns 创建的草稿版本对象
   */
  static async draftVersion(
    dbOrTx: TestDatabase = db as TestDatabase,
    overrides: Partial<any> = {},
  ): Promise<any> {
    const executeInsert = async (tx: TestDatabase) => {
      const mock = Mock.draftVersion();
      const [draftVersion] = await (tx as any)
        .insert(draftVersions)
        .values({
          draftId: overrides.draftId || mock.draftId,
          title: overrides.title || mock.title,
          content: overrides.content || mock.content,
          createdAt: mock.createdAt,
          ...overrides,
        })
        .returning();
      return draftVersion;
    };

    return executeInsert(dbOrTx);
  }
}
