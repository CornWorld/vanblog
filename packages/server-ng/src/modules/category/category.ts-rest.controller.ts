import { Controller, NotFoundException } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@vanblog/shared';

import { CategoryService } from './category.service';

import type { CategoryWithCountDto } from './dto/category.dto';

@Controller()
export class CategoryTsRestController {
  constructor(private readonly categoryService: CategoryService) {}

  @TsRestHandler(contract.getCategories)
  getCategories(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getCategories, async () => {
      const result = await this.categoryService.findAll();
      const items = (result.items as CategoryWithCountDto[]).map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description ?? undefined,
        count: cat.articleCount,
        createAt: cat.createdAt.toISOString(),
        updateAt: cat.updatedAt.toISOString(),
      }));
      return { status: 200, body: items };
    });
  }

  @TsRestHandler(contract.createCategory)
  createCategory(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.createCategory, async ({ body }) => {
      const result = await this.categoryService.create({ name: String(body.name ?? '') });
      return {
        status: 201,
        body: {
          id: result.id,
          name: result.name,
          slug: result.slug,
          description: result.description ?? undefined,
          createAt: result.createdAt.toISOString(),
          updateAt: result.updatedAt.toISOString(),
        },
      };
    });
  }

  @TsRestHandler(contract.updateCategory)
  updateCategory(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateCategory, async ({ params, body }) => {
      const category = await this.categoryService.findByName(String(params.name ?? ''));
      if (!category) {
        throw new NotFoundException(`Category ${params.name} not found`);
      }
      const result = await this.categoryService.update(category.id, body);
      return {
        status: 200,
        body: {
          id: result.id,
          name: result.name,
          slug: result.slug,
          description: result.description ?? undefined,
          createAt: result.createdAt.toISOString(),
          updateAt: result.updatedAt.toISOString(),
        },
      };
    });
  }

  @TsRestHandler(contract.deleteCategory)
  deleteCategory(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.deleteCategory, async ({ params }) => {
      const category = await this.categoryService.findByName(String(params.name ?? ''));
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
      const category = await this.categoryService.findByName(String(params.name ?? ''));
      if (!category) {
        throw new NotFoundException(`Category ${params.name} not found`);
      }
      const result = await this.categoryService.getArticlesByCategoryId(category.id, {
        page: 1,
        pageSize: 1000,
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
      return { status: 200, body: items };
    });
  }
}
