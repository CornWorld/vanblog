import { Controller, NotFoundException } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@vanblog/shared';

import { CategoryService } from './category.service';

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
  getCategories(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getCategories, async () => {
      const result = await this.categoryService.findAll();
      const items = result.items.map((item) => ({
        ...item,
        description: item.description ?? undefined,
      }));
      return { status: 200, body: items };
    });
  }

  @TsRestHandler(contract.createCategory)
  createCategory(): ReturnType<typeof tsRestHandler> {
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
  updateCategory(): ReturnType<typeof tsRestHandler> {
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
  deleteCategory(): ReturnType<typeof tsRestHandler> {
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
  getArticlesByCategory(): ReturnType<typeof tsRestHandler> {
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
      const items = result.items.map((t) => {
        const views = t.viewer ?? 0;
        const top = t.top ?? 0;
        const password = typeof t.password === 'string' ? t.password : undefined;
        const category = typeof t.category === 'string' ? t.category : undefined;
        return {
          id: t.id,
          title: t.title,
          content: t.content,
          summary: undefined,
          cover: undefined,
          category,
          tags: undefined,
          views,
          likes: 0,
          isTop: top > 0,
          isHot: false,
          pubTime: t.updatedAt,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          private: t.private ?? false,
          password,
          toc: undefined,
        };
      });
      return { status: 200, body: items };
    });
  }
}
