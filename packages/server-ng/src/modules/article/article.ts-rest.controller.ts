/* eslint-disable @typescript-eslint/no-explicit-any */
import { Controller, Req } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@vanblog/shared';
import dayjs from 'dayjs';
import { Request } from 'express';

import { ArticleService } from './article.service';
import { CreateArticleDto } from './dto/article.dto';

@Controller()
export class ArticleTsRestController {
  constructor(private readonly articleService: ArticleService) {}

  @TsRestHandler(contract.getAdminArticles)
  getAdminArticles() {
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
      const items = result.items.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        password: item.password ?? undefined,
        category: item.category ?? undefined,
        tags: undefined,
        private: item.private ?? undefined,
      }));
      return { status: 200, body: { ...result, items } };
    });
  }

  @TsRestHandler(contract.createArticle)
  createArticle(@Req() req: Request) {
    return tsRestHandler(contract.createArticle, async ({ body }) => {
      type AuthRequest = Request & { user?: { username?: string } };
      const { user } = req as AuthRequest;
      const result = await this.articleService.create({
        ...body,
        author: user?.username ?? 'admin',
      } as unknown as CreateArticleDto);
      return {
        status: 201,
        body: {
          ...result,
          password: result.password ?? undefined,
          category: result.category ?? undefined,
          tags: undefined,
          private: result.private ?? undefined,
          createdAt: dayjs(result.createdAt).toISOString(),
          updatedAt: dayjs(result.updatedAt).toISOString(),
        },
      };
    });
  }

  @TsRestHandler(contract.updateArticle)
  updateArticle() {
    return tsRestHandler(contract.updateArticle, async ({ params, body }) => {
      const result = await this.articleService.update(Number(params.id), {
        ...body,
        tags: (body.tags ?? null) as any,
      });
      return {
        status: 200,
        body: {
          ...result,
          password: result.password ?? undefined,
          category: result.category ?? undefined,
          tags: undefined,
          private: result.private ?? undefined,
          createdAt: dayjs(result.createdAt).toISOString(),
          updatedAt: dayjs(result.updatedAt).toISOString(),
        },
      };
    });
  }

  @TsRestHandler(contract.deleteArticle)
  deleteArticle() {
    return tsRestHandler(contract.deleteArticle, async ({ params }) => {
      await this.articleService.remove(Number(params.id));
      return { status: 200, body: { success: true } };
    });
  }

  @TsRestHandler(contract.getAdminArticle)
  getAdminArticle() {
    return tsRestHandler(contract.getAdminArticle, async ({ params }) => {
      const result = await this.articleService.findOne(Number(params.id));
      return {
        status: 200,
        body: {
          ...result,
          password: result.password ?? undefined,
          category: result.category ?? undefined,
          tags: undefined,
          private: result.private ?? undefined,
          createdAt: dayjs(result.createdAt).toISOString(),
          updatedAt: dayjs(result.updatedAt).toISOString(),
        },
      };
    });
  }
}
