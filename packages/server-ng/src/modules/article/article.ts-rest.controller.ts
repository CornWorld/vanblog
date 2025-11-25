import { Controller, Req } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@vanblog/shared';
import { Request } from 'express';

import { ArticleService } from './article.service';

@Controller()
export class ArticleTsRestController {
  constructor(private readonly articleService: ArticleService) {}

  @TsRestHandler(contract.getAdminArticles)
  getAdminArticles(): TsRestHandler<typeof contract.getAdminArticles> {
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
      return { status: 200, body: result };
    });
  }

  @TsRestHandler(contract.createArticle)
  createArticle(@Req() req: Request): TsRestHandler<typeof contract.createArticle> {
    return tsRestHandler(contract.createArticle, async ({ body }) => {
      type AuthRequest = Request & { user?: { username?: string } };
      const { user } = req as AuthRequest;
      const result = await this.articleService.create({
        ...body,
        author: user?.username ?? 'admin',
      });
      return { status: 201, body: result };
    });
  }

  @TsRestHandler(contract.updateArticle)
  updateArticle(): TsRestHandler<typeof contract.updateArticle> {
    return tsRestHandler(contract.updateArticle, async ({ params, body }) => {
      const result = await this.articleService.update(Number(params.id), body);
      return { status: 200, body: result };
    });
  }

  @TsRestHandler(contract.deleteArticle)
  deleteArticle(): TsRestHandler<typeof contract.deleteArticle> {
    return tsRestHandler(contract.deleteArticle, async ({ params }) => {
      await this.articleService.remove(Number(params.id));
      return { status: 200, body: { success: true } };
    });
  }

  @TsRestHandler(contract.getAdminArticle)
  getAdminArticle(): TsRestHandler<typeof contract.getAdminArticle> {
    return tsRestHandler(contract.getAdminArticle, async ({ params }) => {
      const result = await this.articleService.findOne(Number(params.id));
      return { status: 200, body: result };
    });
  }
}
