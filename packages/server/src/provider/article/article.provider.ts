import { Inject, Injectable, forwardRef, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document, SortOrder, Types } from 'mongoose';
import { CreateArticleDto, SearchArticleOption, UpdateArticleDto } from 'src/types/article.dto';
import { Article, ArticleDocument } from 'src/scheme/article.schema';
import { parseImgLinksOfMarkdown } from 'src/utils/parseImgOfMarkdown';
import { wordCount } from 'src/utils/wordCount';
import { MetaProvider } from '../meta/meta.provider';
import { VisitProvider } from '../visit/visit.provider';
import { sleep } from 'src/utils/sleep';
import { CategoryDocument } from 'src/scheme/category.schema';

export type ArticleView = 'admin' | 'public' | 'list';

// Define a type for the Mongoose document with _doc property
type MongooseDocument<T> = T & Document<Types.ObjectId> & { _doc?: T };
type ArticleDocumentType = MongooseDocument<Article>;

// Define sort type compatible with Mongoose
type MongooseSortOption = Record<string, SortOrder>;

@Injectable()
export class ArticleProvider {
  idLock = false;
  constructor(
    @InjectModel('Article')
    private articleModel: Model<ArticleDocument>,
    @InjectModel('Category') private categoryModal: Model<CategoryDocument>,
    @Inject(forwardRef(() => MetaProvider))
    private readonly metaProvider: MetaProvider,
    private readonly visitProvider: VisitProvider,
  ) {}
  publicView = {
    title: 1,
    content: 1,
    tags: 1,
    category: 1,
    updatedAt: 1,
    createdAt: 1,
    lastVisitedTime: 1,
    id: 1,
    top: 1,
    _id: 0,
    viewer: 1,
    visited: 1,
    private: 1,
    hidden: 1,
    author: 1,
    copyright: 1,
    pathname: 1,
  };

  adminView = {
    title: 1,
    content: 1,
    tags: 1,
    category: 1,
    lastVisitedTime: 1,
    updatedAt: 1,
    createdAt: 1,
    id: 1,
    top: 1,
    hidden: 1,
    password: 1,
    private: 1,
    _id: 0,
    viewer: 1,
    visited: 1,
    author: 1,
    copyright: 1,
    pathname: 1,
  };

  listView = {
    title: 1,
    tags: 1,
    category: 1,
    updatedAt: 1,
    lastVisitedTime: 1,
    createdAt: 1,
    id: 1,
    top: 1,
    hidden: 1,
    private: 1,
    _id: 0,
    viewer: 1,
    visited: 1,
    author: 1,
    copyright: 1,
    pathname: 1,
  };

  toPublic(oldArticles: Article[]) {
    return oldArticles.map((item) => {
      return {
        title: item.title,
        content: item.content,
        tags: item.tags,
        category: item.category,
        updatedAt: item.updatedAt,
        createdAt: item.createdAt,
        id: item.id,
        top: item.top,
      };
    });
  }
  async create(
    createArticleDto: CreateArticleDto,
    skipUpdateWordCount?: boolean,
    id?: number,
  ): Promise<Article> {
    const createdData = new this.articleModel(createArticleDto);
    const newId = id || (await this.getNewId());
    createdData.id = newId;
    if (!skipUpdateWordCount) {
      this.metaProvider.updateTotalWords('新建文章');
    }
    const res = createdData.save();
    return res;
  }
  async searchArticlesByLink(link: string) {
    const artciles = await this.articleModel.find(
      {
        content: { $regex: link, $options: 'i' },
        $or: [
          {
            deleted: false,
          },
          {
            deleted: { $exists: false },
          },
        ],
      },
      this.listView,
    );
    return artciles;
  }
  async getAllImageLinks() {
    const res = [];
    const articles = await this.articleModel.find({
      $or: [
        {
          deleted: false,
        },
        {
          deleted: { $exists: false },
        },
      ],
    });
    for (const article of articles) {
      const eachLinks = parseImgLinksOfMarkdown(article.content || '');
      res.push({
        articleId: article.id,
        title: article.title,
        links: eachLinks,
      });
    }
    return res;
  }

  async updateViewerByPathname(pathname: string, isNew: boolean) {
    let article = await this.getByPathName(pathname, 'list');
    if (!article) {
      // Try to get by ID
      article = await this.getById(pathname, 'list');
      if (!article) {
        return;
      }
    }
    const oldViewer = article.viewer || 0;
    const oldVIsited = article.visited || 0;
    const newViewer = oldViewer + 1;
    const newVisited = isNew ? oldVIsited + 1 : oldVIsited;
    const nowTime = new Date();
    await this.articleModel.updateOne(
      { id: article.id },
      { visited: newVisited, viewer: newViewer, lastVisitedTime: nowTime },
    );
  }

  async updateViewer(id: number | string, isNew: boolean) {
    const article = await this.getById(id, 'list');
    if (!article) {
      return;
    }
    const oldViewer = article.viewer || 0;
    const oldVIsited = article.visited || 0;
    const newViewer = oldViewer + 1;
    const newVisited = isNew ? oldVIsited + 1 : oldVIsited;
    const nowTime = new Date();
    await this.articleModel.updateOne(
      { id: article.id },
      { visited: newVisited, viewer: newViewer, lastVisitedTime: nowTime },
    );
  }

  async getRecentVisitedArticles(num: number, view: ArticleView) {
    return await this.articleModel
      .find(
        {
          lastVisitedTime: { $exists: true },
          $or: [
            {
              deleted: false,
            },
            {
              deleted: { $exists: false },
            },
          ],
        },
        this.getView(view),
      )
      .sort({ lastVisitedTime: -1 })
      .limit(num);
  }

  async getTopViewer(view: ArticleView, num: number) {
    return await this.articleModel
      .find(
        {
          viewer: { $ne: 0, $exists: true },
          $or: [
            {
              deleted: false,
            },
            {
              deleted: { $exists: false },
            },
          ],
        },
        this.getView(view),
      )
      .sort({ viewer: -1 })
      .limit(num);
  }
  async getTopVisited(view: ArticleView, num: number) {
    return await this.articleModel
      .find(
        {
          viewer: { $ne: 0, $exists: true },
          $or: [
            {
              deleted: false,
            },
            {
              deleted: { $exists: false },
            },
          ],
        },
        this.getView(view),
      )
      .sort({ visited: -1 })
      .limit(num);
  }

  async washViewerInfoByVisitProvider() {
    // 用 visitProvider 里面的数据洗一下 article 的。
    const articles = await this.getAll('list', true);
    for (const a of articles) {
      const visitData = await this.visitProvider.getByArticleId(a.id);
      if (visitData) {
        const updateDto = {
          viewer: visitData.viewer,
          visited: visitData.visited,
        };
        await this.updateById(a.id, updateDto);
      }
    }
  }

  async washViewerInfoToVisitProvider() {
    // 用 visitProvider 里面的数据洗一下 article 的。
    const articles = await this.getAll('list', true);
    for (const a of articles) {
      await this.visitProvider.rewriteToday(`/post/${a.id}`, a.viewer, a.visited);
    }
  }

  async importArticles(articles: Article[]) {
    // 先获取一遍新的 id
    // for (let i = 0; i < articles.length; i++) {
    //   const newId = await this.getNewId();
    //   articles[i].id = newId;
    // }

    // id 相同就合并，以导入的优先
    for (const a of articles) {
      const { id, ...createDto } = a;
      const oldArticle = await this.getById(id, 'admin');
      if (oldArticle) {
        this.updateById(
          oldArticle.id,
          {
            ...createDto,
            deleted: false,
            updatedAt: oldArticle.updatedAt || oldArticle.createdAt,
          },
          true,
        );
      } else {
        await this.create(
          {
            ...createDto,
            updatedAt: createDto.updatedAt || createDto.createdAt || new Date(),
          },
          true,
          id,
        );
      }
    }
    this.metaProvider.updateTotalWords('导入文章');
  }

  async countTotalWords() {
    //! 默认不保存 hidden 文章的！
    let total = 0;
    const $and: Array<Record<string, unknown>> = [
      {
        $or: [
          {
            deleted: false,
          },
          {
            deleted: { $exists: false },
          },
        ],
      },
      {
        $or: [
          {
            hidden: false,
          },
          {
            hidden: { $exists: false },
          },
        ],
      },
    ];
    const articles = await this.articleModel
      .find({
        $and,
      })
      .exec();
    articles.forEach((a) => {
      total = total + wordCount(a.content);
    });
    return total;
  }
  async getTotalNum(includeHidden: boolean) {
    const $and: Array<Record<string, unknown>> = [
      {
        $or: [
          {
            deleted: false,
          },
          {
            deleted: { $exists: false },
          },
        ],
      },
    ];
    if (!includeHidden) {
      $and.push({
        $or: [
          {
            hidden: false,
          },
          {
            hidden: { $exists: false },
          },
        ],
      });
    }
    return await this.articleModel
      .find({
        $and,
      })
      .countDocuments();
  }

  getView(view: ArticleView) {
    let thisView: Record<string, number> = this.adminView;
    switch (view) {
      case 'admin':
        thisView = this.adminView;
        break;
      case 'list':
        thisView = this.listView;
        break;
      case 'public':
        thisView = this.publicView;
    }
    return thisView;
  }

  async getAll(
    view: ArticleView,
    includeHidden: boolean,
    includeDelete?: boolean,
  ): Promise<Article[]> {
    const thisView: Record<string, number> = this.getView(view);
    const $and: Array<Record<string, unknown>> = [];
    if (!includeDelete) {
      $and.push({
        $or: [
          {
            deleted: false,
          },
          {
            deleted: { $exists: false },
          },
        ],
      });
    }
    if (!includeHidden) {
      $and.push({
        $or: [
          {
            hidden: false,
          },
          {
            hidden: { $exists: false },
          },
        ],
      });
    }

    const articles = await this.articleModel
      .find(
        $and.length > 0
          ? {
              $and,
            }
          : undefined,
        thisView,
      )
      .sort({ createdAt: -1 })
      .exec();
    return articles;
  }

  async getTimeLineInfo() {
    // 肯定是不需要具体内容的，一个列表就好了
    const articles = await this.articleModel
      .find(
        {
          $and: [
            {
              $or: [
                {
                  deleted: false,
                },
                {
                  deleted: { $exists: false },
                },
              ],
            },
            {
              $or: [
                {
                  hidden: false,
                },
                {
                  hidden: { $exists: false },
                },
              ],
            },
          ],
        },
        this.listView,
      )
      .sort({ createdAt: -1 })
      .exec();
    // 清洗一下数据。
    const dates = Array.from(new Set(articles.map((a) => a.createdAt.getFullYear())));
    const res: Record<string, Article[]> = {};
    dates.forEach((date) => {
      res[date] = articles.filter((a) => a.createdAt.getFullYear() == date);
    });
    return res;
  }
  async getByOption(
    option: SearchArticleOption,
    isPublic: boolean,
  ): Promise<{ articles: Article[]; total: number; totalWordCount?: number }> {
    const query: Record<string, unknown> = {};
    const $and: Array<Record<string, unknown>> = [
      {
        $or: [
          {
            deleted: false,
          },
          {
            deleted: { $exists: false },
          },
        ],
      },
    ];
    const and = [];
    let sort: MongooseSortOption = { createdAt: -1 as SortOrder };
    if (isPublic) {
      $and.push({
        $or: [
          {
            hidden: false,
          },
          {
            hidden: { $exists: false },
          },
        ],
      });
    }

    if (option.sortTop) {
      if (option.sortTop == 'asc') {
        sort = { top: 1 };
      } else {
        sort = { top: -1 };
      }
    }
    if (option.sortViewer) {
      if (option.sortViewer == 'asc') {
        sort = { viewer: 1 };
      } else {
        sort = { viewer: -1 };
      }
    }
    if (option.sortCreatedAt) {
      if (option.sortCreatedAt == 'asc') {
        sort = { createdAt: 1 };
      }
    }
    if (option.tags) {
      const tags = option.tags.split(',');
      const or: Array<Record<string, unknown>> = [];
      tags.forEach((t) => {
        if (option.regMatch) {
          or.push({
            tags: { $regex: `${t}`, $options: 'i' },
          });
        } else {
          or.push({
            tags: t,
          });
        }
      });
      and.push({ $or: or });
    }
    if (option.category) {
      if (option.regMatch) {
        and.push({
          category: { $regex: `${option.category}`, $options: 'i' },
        });
      } else {
        and.push({
          category: option.category,
        });
      }
    }
    if (option.title) {
      and.push({
        title: { $regex: `${option.title}`, $options: 'i' },
      });
    }
    if (option.startTime || option.endTime) {
      const obj: Record<string, unknown> = {};
      if (option.startTime) {
        obj['$gte'] = new Date(option.startTime);
      }
      if (option.endTime) {
        obj['$lte'] = new Date(option.endTime);
      }
      $and.push({ createdAt: obj });
    }

    if (and.length) {
      $and.push({ $and: and });
    }

    query.$and = $and;
    // console.log(JSON.stringify(query, null, 2));
    // console.log(JSON.stringify(sort, null, 2));
    let view: Record<string, number> = isPublic ? this.publicView : this.adminView;
    if (option.toListView) {
      view = this.listView;
    }
    if (option.withWordCount) {
      view = isPublic ? this.publicView : this.adminView;
    }
    let articlesQuery = this.articleModel.find(query, view).sort(sort);
    if (option.pageSize != -1 && !isPublic) {
      articlesQuery = articlesQuery
        .skip(option.pageSize * option.page - option.pageSize)
        .limit(option.pageSize);
    }

    let articles = await articlesQuery.exec();
    // public 下 包括所有的，
    if (isPublic && option.pageSize != -1) {
      // 把 top 的诺到前面去
      const topArticles = articles.filter((a) => {
        const doc = a as ArticleDocumentType;
        const top = doc._doc?.top || doc.top;
        return Boolean(top) && top !== 0;
      });
      const notTopArticles = articles.filter((a) => {
        const doc = a as ArticleDocumentType;
        const top = doc._doc?.top || doc.top;
        return !top || top === 0;
      });
      const sortedTopArticles = topArticles.sort((a, b) => {
        const docA = a as ArticleDocumentType;
        const docB = b as ArticleDocumentType;
        const topA = docA._doc?.top || docA.top;
        const topB = docB._doc?.top || docB.top;
        if (topA > topB) {
          return -1;
        } else if (topB > topA) {
          return 1;
        } else {
          return 0;
        }
      });
      articles = [...sortedTopArticles, ...notTopArticles];
      const skip = option.pageSize * option.page - option.pageSize;
      const rawEnd = skip + option.pageSize;
      const end = rawEnd > articles.length - 1 ? articles.length : rawEnd;
      articles = articles.slice(skip, end);
    }
    // withWordCount 只会返回当前分页的文字数量

    const total = await this.articleModel.countDocuments(query).exec();
    // 过滤私有文章
    if (isPublic) {
      const tmpArticles: Article[] = [];
      for (const a of articles) {
        const doc = a as ArticleDocumentType;
        const isPrivateInArticle = doc._doc?.private || doc.private;
        const category = await this.categoryModal.findOne({
          name: doc._doc?.category || doc.category,
        });
        const isPrivateInCategory = category?.private || false;
        const isPrivate = isPrivateInArticle || isPrivateInCategory;
        if (isPrivate) {
          tmpArticles.push({
            ...(doc._doc || (doc as unknown as Article)),
            content: undefined,
            password: undefined,
            private: true,
          } as Article);
        } else {
          tmpArticles.push({
            ...(doc._doc || (doc as unknown as Article)),
          } as Article);
        }
      }
      articles = tmpArticles as unknown as typeof articles;
    }
    const resData: { articles: Article[]; total: number; totalWordCount?: number } = {
      articles: [],
      total: 0,
    };
    if (option.withWordCount) {
      let totalWordCount = 0;
      articles.forEach((a) => {
        totalWordCount = totalWordCount + wordCount(a?.content || '');
      });
      resData.totalWordCount = totalWordCount;
    }
    if (option.withWordCount && option.toListView) {
      // 重置视图
      resData.articles = articles.map((a) => {
        const doc = a as ArticleDocumentType;
        return {
          ...(doc._doc || (doc as unknown as Article)),
          content: undefined,
          password: undefined,
        } as Article;
      });
    } else {
      resData.articles = articles as unknown as Article[];
    }

    resData.total = total;
    return resData;
  }

  async getByIdOrPathname(id: string | number, view: ArticleView) {
    try {
      // First try to get by pathname
      const articleByPathname = await this.getByPathName(String(id), view);
      if (articleByPathname) {
        return articleByPathname;
      }

      // Then try by ID
      const article = await this.getById(id, view);
      if (!article) {
        throw new NotFoundException('找不到文章');
      }
      return article;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error in getByIdOrPathname:', error);
      throw new NotFoundException('找不到文章');
    }
  }

  async getByPathName(pathname: string, view: ArticleView): Promise<Article | null> {
    if (!pathname) {
      return null;
    }

    const $and: Array<Record<string, unknown>> = [
      {
        $or: [
          {
            deleted: false,
          },
          {
            deleted: { $exists: false },
          },
        ],
      },
    ];

    try {
      // Handle both encoded and decoded pathnames
      const decodedPath = decodeURIComponent(pathname);
      const encodedPath = encodeURIComponent(pathname);

      const article = await this.articleModel
        .findOne(
          {
            $and,
            $or: [{ pathname: decodedPath }, { pathname: encodedPath }, { pathname: pathname }],
          },
          this.getView(view),
        )
        .exec();

      return article || null;
    } catch (error) {
      console.error('Error finding article by pathname:', error);
      return null;
    }
  }

  async getById(id: number | string | undefined, view: ArticleView): Promise<Article | null> {
    // Handle invalid id values
    if (id === undefined || id === null) {
      return null;
    }

    // Convert string id to number if needed
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;

    // Handle NaN and invalid numbers
    if (typeof numericId !== 'number' || isNaN(numericId)) {
      return null;
    }

    const $and: Array<Record<string, unknown>> = [
      {
        $or: [
          {
            deleted: false,
          },
          {
            deleted: { $exists: false },
          },
        ],
      },
    ];

    return await this.articleModel
      .findOne(
        {
          id: numericId,
          $and,
        },
        this.getView(view),
      )
      .exec();
  }
  async getByIdWithPassword(id: number | string, password: string): Promise<Article | null> {
    const article = await this.getByIdOrPathname(id, 'admin');
    if (!password) {
      return null;
    }
    if (!article) {
      return null;
    }
    const category =
      (await this.categoryModal.findOne({
        name: article.category,
      })) || ({} as CategoryDocument);

    const categoryPassword = category.private ? category.password : undefined;
    const targetPassword = categoryPassword ? categoryPassword : article.password;

    if (!targetPassword || targetPassword == '') {
      const doc = article as ArticleDocumentType;
      return {
        ...(doc._doc || (doc as unknown as Article)),
        password: undefined,
      } as Article;
    } else {
      if (targetPassword == password) {
        const doc = article as ArticleDocumentType;
        return {
          ...(doc._doc || (doc as unknown as Article)),
          password: undefined,
        } as Article;
      } else {
        return null;
      }
    }
  }
  async getByIdOrPathnameWithPreNext(id: string | number, view: ArticleView) {
    const curArticle = await this.getByIdOrPathname(id, view);
    if (!curArticle) {
      throw new NotFoundException('找不到文章');
    }

    if (curArticle.hidden) {
      const siteInfo = await this.metaProvider.getSiteInfo();
      if (!siteInfo?.allowOpenHiddenPostByUrl || siteInfo?.allowOpenHiddenPostByUrl == 'false') {
        throw new NotFoundException('该文章是隐藏文章！');
      }
    }
    if (curArticle.private) {
      curArticle.content = undefined;
    } else {
      // 检查分类是不是加密了
      const category = await this.categoryModal.findOne({
        name: curArticle.category,
      });
      if (category && category.private) {
        curArticle.private = true;
        curArticle.content = undefined;
      }
    }
    const res: { article: Article; pre?: Article; next?: Article } = { article: curArticle };
    // 找它的前一个和后一个。
    const preArticle = await this.getPreArticleByArticle(curArticle, 'list');
    const nextArticle = await this.getNextArticleByArticle(curArticle, 'list');
    if (preArticle) {
      res.pre = preArticle;
    }
    if (nextArticle) {
      res.next = nextArticle;
    }
    return res;
  }
  async getPreArticleByArticle(article: Article, view: ArticleView, includeHidden?: boolean) {
    const $and: Array<Record<string, unknown>> = [
      {
        $or: [
          {
            deleted: false,
          },
          {
            deleted: { $exists: false },
          },
        ],
      },
      { createdAt: { $lt: article.createdAt } },
    ];
    if (!includeHidden) {
      $and.push({
        $or: [
          {
            hidden: false,
          },
          {
            hidden: { $exists: false },
          },
        ],
      });
    }
    const result = await this.articleModel
      .find(
        {
          $and,
        },
        this.getView(view),
      )
      .sort({ createdAt: -1 })
      .limit(1);
    if (result.length) {
      return result[0];
    }
    return null;
  }
  async getNextArticleByArticle(article: Article, view: ArticleView, includeHidden?: boolean) {
    const $and: Array<Record<string, unknown>> = [
      {
        $or: [
          {
            deleted: false,
          },
          {
            deleted: { $exists: false },
          },
        ],
      },
      { createdAt: { $gt: article.createdAt } },
    ];
    if (!includeHidden) {
      $and.push({
        $or: [
          {
            hidden: false,
          },
          {
            hidden: { $exists: false },
          },
        ],
      });
    }
    const result = await this.articleModel
      .find(
        {
          $and,
        },
        this.getView(view),
      )
      .sort({ createdAt: 1 })
      .limit(1);
    if (result.length) {
      return result[0];
    }
    return null;
  }

  async findOneByTitle(title: string): Promise<Article> {
    return this.articleModel.findOne({ title }).exec();
  }

  toSearchResult(articles: Article[]) {
    return articles.map((each) => ({
      title: each.title,
      id: each.pathname ? each.pathname : each.id,
      category: each.category,
      tags: each.tags,
      updatedAt: each.updatedAt,
      createdAt: each.createdAt,
    }));
  }

  async searchByString(str: string, includeHidden: boolean): Promise<Article[]> {
    const $and: Array<Record<string, unknown>> = [
      {
        $or: [
          { content: { $regex: `${str}`, $options: 'i' } },
          { title: { $regex: `${str}`, $options: 'i' } },
          { category: { $regex: `${str}`, $options: 'i' } },
          { tags: { $regex: `${str}`, $options: 'i' } },
        ],
      },
      {
        $or: [
          {
            deleted: false,
          },
          {
            deleted: { $exists: false },
          },
        ],
      },
    ];
    if (!includeHidden) {
      $and.push({
        $or: [
          {
            hidden: false,
          },
          {
            hidden: { $exists: false },
          },
        ],
      });
    }
    const rawData = await this.articleModel
      .find({
        $and,
      })
      .exec();
    const s = str.toLocaleLowerCase();
    const titleData = rawData.filter((each) => each.title.toLocaleLowerCase().includes(s));
    const contentData = rawData.filter((each) => each.content.toLocaleLowerCase().includes(s));
    const categoryData = rawData.filter((each) => each.category.toLocaleLowerCase().includes(s));
    const tagData = rawData.filter((each) =>
      each.tags.map((t) => t.toLocaleLowerCase()).includes(s),
    );
    const sortedData = [...titleData, ...contentData, ...tagData, ...categoryData];
    const resData = [];
    for (const e of sortedData) {
      if (!resData.includes(e)) {
        resData.push(e);
      }
    }
    return resData;
  }

  async findAll(): Promise<Article[]> {
    return this.articleModel.find({}).exec();
  }
  async deleteById(id: number) {
    const res = await this.articleModel.updateOne({ id }, { deleted: true }).exec();
    this.metaProvider.updateTotalWords('删除文章');
    return res;
  }

  async updateById(id: number, updateArticleDto: UpdateArticleDto, skipUpdateWordCount?: boolean) {
    const res = await this.articleModel.updateOne(
      { id },
      {
        ...updateArticleDto,
        updatedAt: updateArticleDto.updatedAt || new Date(),
      },
    );
    if (!skipUpdateWordCount) {
      this.metaProvider.updateTotalWords('更新文章');
    }
    return res;
  }

  async getNewId() {
    while (this.idLock) {
      await sleep(10);
    }
    this.idLock = true;
    const maxObj = await this.articleModel.find({}).sort({ id: -1 }).limit(1);
    let res = 1;
    if (maxObj.length) {
      res = maxObj[0].id + 1;
    }
    this.idLock = false;
    return res;
  }
}
