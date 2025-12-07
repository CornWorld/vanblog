import { Controller, Req } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract, dayjs } from '@vanblog/shared';
import { Request } from 'express';

import { ArticleService } from './article.service';

@Controller()
export class ArticleTsRestController {
  constructor(private readonly articleService: ArticleService) {}

  private getUsernameFromRequest(req: Request): string | undefined {
    const maybeUser = (req as unknown as { user?: { username?: unknown } }).user;
    const username = maybeUser?.username;
    return typeof username === 'string' ? username : undefined;
  }

  @TsRestHandler(contract.getAdminArticles)
  getAdminArticles(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getAdminArticles, async ({ query }) => {
      const result = await this.articleService.findAll({
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 10,
        category: query.category,
        tag: query.tag,
        isTop: query.topping,
        isPublished: query.hidden !== undefined ? !query.hidden : undefined,
        includeHidden: true,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      const rawItems: unknown = result.items;
      const items = Array.isArray(rawItems)
        ? rawItems.map((item) => {
            const t = item as Record<string, unknown>;
            const id = typeof t.id === 'number' ? t.id : Number(t.id ?? 0);
            const views = typeof t.viewer === 'number' ? t.viewer : Number(t.viewer ?? 0);
            const top = typeof t.top === 'number' ? t.top : Number(t.top ?? 0);
            const createdAt =
              typeof t.createdAt === 'string' ? t.createdAt : String(t.createdAt ?? '');
            const updatedAt =
              typeof t.updatedAt === 'string' ? t.updatedAt : String(t.updatedAt ?? createdAt);
            const password = typeof t.password === 'string' ? t.password : undefined;
            const category = typeof t.category === 'string' ? t.category : undefined;
            return {
              id,
              title: String(t.title ?? ''),
              content: String(t.content ?? ''),
              summary: undefined,
              cover: undefined,
              category,
              tags: undefined,
              views,
              likes: 0,
              isTop: top > 0,
              isHot: false,
              pubTime: dayjs(updatedAt ?? createdAt).format(),
              createdAt: dayjs(createdAt).format(),
              updatedAt: dayjs(updatedAt).format(),
              private: Boolean(t.private ?? false),
              password,
              toc: undefined,
            };
          })
        : [];
      const { items: _omitItems, ...restResult } = result;
      return { status: 200, body: { ...restResult, items } };
    });
  }

  @TsRestHandler(contract.createArticle)
  createArticle(@Req() req: Request): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.createArticle, async ({ body }) => {
      const username = this.getUsernameFromRequest(req);
      const result = await this.articleService.create({
        ...body,
        author: username ?? 'admin',
        tags: JSON.stringify(Array.isArray(body.tags) ? body.tags : []),
      });
      const views = Number(result.viewer ?? 0);
      const top = Number(result.top ?? 0);
      return {
        status: 201,
        body: {
          id: result.id,
          title: String(result.title ?? ''),
          content: String(result.content ?? ''),
          summary: undefined,
          cover: undefined,
          category: result.category ?? undefined,
          tags: undefined,
          views,
          likes: 0,
          isTop: top > 0,
          isHot: false,
          pubTime: dayjs(result.updatedAt ?? result.createdAt).format(),
          createdAt: dayjs(result.createdAt).format(),
          updatedAt: dayjs(result.updatedAt).format(),
          private: Boolean(result.private ?? false),
          password: result.password ?? undefined,
          toc: undefined,
        },
      };
    });
  }

  @TsRestHandler(contract.updateArticle)
  updateArticle(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateArticle, async ({ params, body }) => {
      const id = typeof params.id === 'string' ? Number(params.id) : params.id;
      const tags = Array.isArray(body.tags)
        ? JSON.stringify(body.tags)
        : typeof body.tags === 'string'
          ? body.tags
          : null;
      const result = await this.articleService.update(id, {
        ...body,
        tags,
      });
      const views = Number(result.viewer ?? 0);
      const top = Number(result.top ?? 0);
      return {
        status: 200,
        body: {
          id: result.id,
          title: String(result.title ?? ''),
          content: String(result.content ?? ''),
          summary: undefined,
          cover: undefined,
          category: result.category ?? undefined,
          tags: undefined,
          views,
          likes: 0,
          isTop: top > 0,
          isHot: false,
          pubTime: dayjs(result.updatedAt ?? result.createdAt).format(),
          createdAt: dayjs(result.createdAt).format(),
          updatedAt: dayjs(result.updatedAt).format(),
          private: Boolean(result.private ?? false),
          password: result.password ?? undefined,
          toc: undefined,
        },
      };
    });
  }

  @TsRestHandler(contract.deleteArticle)
  deleteArticle(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.deleteArticle, async ({ params }) => {
      const id = typeof params.id === 'string' ? Number(params.id) : params.id;
      await this.articleService.remove(id);
      return { status: 200, body: { success: true } };
    });
  }

  @TsRestHandler(contract.getAdminArticle)
  getAdminArticle(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getAdminArticle, async ({ params }) => {
      const id = typeof params.id === 'string' ? Number(params.id) : params.id;
      const result = await this.articleService.findOne(id);
      const views = Number(result.viewer ?? 0);
      const top = Number(result.top ?? 0);
      return {
        status: 200,
        body: {
          id: result.id,
          title: String(result.title ?? ''),
          content: String(result.content ?? ''),
          summary: undefined,
          cover: undefined,
          category: result.category ?? undefined,
          tags: undefined,
          views,
          likes: 0,
          isTop: top > 0,
          isHot: false,
          pubTime: dayjs(result.updatedAt ?? result.createdAt).format(),
          createdAt: dayjs(result.createdAt).format(),
          updatedAt: dayjs(result.updatedAt).format(),
          private: Boolean(result.private ?? false),
          password: result.password ?? undefined,
          toc: undefined,
        },
      };
    });
  }
}
