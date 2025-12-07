import { Controller, NotFoundException } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@vanblog/shared';
import { z } from 'zod';

import { ArticleSchema } from '../article/dto/article.dto';

import { CategoryService } from './category.service';
import { CategoryWithCountSchema } from './dto/category.dto';

type CategoryWithCount = z.infer<typeof CategoryWithCountSchema>;
type Article = z.infer<typeof ArticleSchema>;

@Controller()
export class CategoryTsRestController {
  constructor(private readonly categoryService: CategoryService) {}

  @TsRestHandler(contract.getCategories)
  async getCategories() {
    return tsRestHandler(contract.getCategories, async () => {
      const result = await this.categoryService.findAll();
      const items = result.items.map((item: CategoryWithCount) => ({
        ...item,
        description: item.description ?? undefined,
      }));
      return { status: 200, body: items };
    });
  }

  @TsRestHandler(contract.createCategory)
  async createCategory() {
    return tsRestHandler(contract.createCategory, async ({ body }) => {
      const result = await this.categoryService.create({
        ...body,
        name: body.name,
      });
      return {
        status: 201,
        body: { ...result, description: result.description ?? undefined },
      };
    });
  }

  @TsRestHandler(contract.updateCategory)
  async updateCategory() {
    return tsRestHandler(contract.updateCategory, async ({ params, body }) => {
      const category = await this.categoryService.findByName(params.name);
      if (!category) {
        throw new NotFoundException(`Category ${params.name} not found`);
      }
      const result = await this.categoryService.update(category.id, body);
      return {
        status: 200,
        body: { ...result, description: result.description ?? undefined },
      };
    });
  }

  @TsRestHandler(contract.deleteCategory)
  async deleteCategory() {
    return tsRestHandler(contract.deleteCategory, async ({ params }) => {
      const category = await this.categoryService.findByName(params.name);
      if (!category) {
        throw new NotFoundException(`Category ${params.name} not found`);
      }
      await this.categoryService.remove(category.id);
      return { status: 200, body: { success: true } };
    });
  }

  @TsRestHandler(contract.getArticlesByCategory)
  async getArticlesByCategory() {
    return tsRestHandler(contract.getArticlesByCategory, async ({ params }) => {
      const category = await this.categoryService.findByName(params.name);
      if (!category) {
        throw new NotFoundException(`Category ${params.name} not found`);
      }
      const result = await this.categoryService.getArticlesByCategoryId(category.id, {
        page: 1,
        pageSize: 1000,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      const items = result.items.map((t: Article) => {
        const views = typeof t.viewer === 'number' ? t.viewer : Number(t.viewer ?? 0);
        const top = typeof t.top === 'number' ? t.top : Number(t.top ?? 0);
        const createdAt = typeof t.createdAt === 'string' ? t.createdAt : String(t.createdAt ?? '');
        const updatedAt =
          typeof t.updatedAt === 'string' ? t.updatedAt : String(t.updatedAt ?? createdAt);
        const password = typeof t.password === 'string' ? t.password : undefined;
        const category = typeof t.category === 'string' ? t.category : undefined;
        return {
          id: Number(t.id),
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
          pubTime: updatedAt,
          createdAt,
          updatedAt,
          private: Boolean(t.private ?? false),
          password,
          toc: undefined,
        };
      });
      return { status: 200, body: items };
    });
  }
}
