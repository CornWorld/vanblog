import { Controller, NotFoundException } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@vanblog/shared';
import { z } from 'zod';

import { ArticleListResponseDto } from '../article/dto/article.dto';

import { CategoryService } from './category.service';
import { CategoryWithCountDto, CategoryListResponseDto, CategoryDto } from './dto/category.dto';

// Types inferred from contract schemas
type CategoryResponse = z.infer<(typeof contract.getCategories.responses)[200]>[number];
type ArticleResponse = z.infer<(typeof contract.getArticlesByCategory.responses)[200]>[number];

/**
 * 分类管理控制器
 *
 * 提供分类的 CRUD 操作，包括创建、查询、更新和删除分类，
 * 以及分类密码验证、统计信息获取等功能。
 *
 * @author VanBlog Team
 * @since 2.0.0
 */
@Controller()
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @TsRestHandler(contract.getCategories)
  async getCategories() {
    return tsRestHandler(contract.getCategories, async () => {
      const result: CategoryListResponseDto = await this.categoryService.findAll();
      const items: CategoryResponse[] = result.items.map((item: CategoryWithCountDto) => ({
        id: item.id,
        name: item.name,
        description: item.description ?? undefined,
        count: item.articleCount,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }));
      return { status: 200 as const, body: items };
    });
  }

  @TsRestHandler(contract.createCategory)
  async createCategory() {
    return tsRestHandler(contract.createCategory, async ({ body }) => {
      const result: CategoryDto = await this.categoryService.create({
        name: body.name,
        description: body.description,
      });
      const response: CategoryResponse = {
        id: result.id,
        name: result.name,
        description: result.description ?? undefined,
        count: undefined,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      };
      return { status: 201 as const, body: response };
    });
  }

  @TsRestHandler(contract.updateCategory)
  async updateCategory() {
    return tsRestHandler(contract.updateCategory, async ({ params, body }) => {
      const category = await this.categoryService.findByName(params.name);
      if (!category) {
        throw new NotFoundException(`Category ${params.name} not found`);
      }
      const result: CategoryDto = await this.categoryService.update(category.id, {
        name: body.name,
        description: body.description,
        password: body.password,
      });
      const response: CategoryResponse = {
        id: result.id,
        name: result.name,
        description: result.description ?? undefined,
        count: undefined,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      };
      return { status: 200 as const, body: response };
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
      return { status: 200 as const, body: { success: true } };
    });
  }

  @TsRestHandler(contract.getArticlesByCategory)
  async getArticlesByCategory() {
    return tsRestHandler(contract.getArticlesByCategory, async ({ params }) => {
      const category = await this.categoryService.findByName(params.name);
      if (!category) {
        throw new NotFoundException(`Category ${params.name} not found`);
      }
      const result: ArticleListResponseDto = await this.categoryService.getArticlesByCategoryId(
        category.id,
        {
          page: 1,
          pageSize: 1000,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        },
      );
      const items: ArticleResponse[] = result.items.map((t) => {
        const views = typeof t.viewer === 'number' ? t.viewer : Number(t.viewer ?? 0);
        const top = typeof t.top === 'number' ? t.top : Number(t.top ?? 0);
        const createdAt = typeof t.createdAt === 'string' ? t.createdAt : String(t.createdAt ?? '');
        const updatedAt =
          typeof t.updatedAt === 'string' ? t.updatedAt : String(t.updatedAt ?? createdAt);
        const password = typeof t.password === 'string' ? t.password : undefined;
        const categoryName = typeof t.category === 'string' ? t.category : undefined;
        return {
          id: Number(t.id),
          title: String(t.title ?? ''),
          content: String(t.content ?? ''),
          summary: undefined,
          cover: undefined,
          category: categoryName,
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
      return { status: 200 as const, body: items };
    });
  }
}
