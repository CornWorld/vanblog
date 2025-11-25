import { Controller, NotFoundException } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@vanblog/shared';

import { CategoryService } from './category.service';

@Controller()
export class CategoryTsRestController {
  constructor(private readonly categoryService: CategoryService) {}

  @TsRestHandler(contract.getCategories)
  getCategories(): TsRestHandler<typeof contract.getCategories> {
    return tsRestHandler(contract.getCategories, async () => {
      const result = await this.categoryService.findAll();
      return { status: 200, body: result.items };
    });
  }

  @TsRestHandler(contract.createCategory)
  createCategory(): TsRestHandler<typeof contract.createCategory> {
    return tsRestHandler(contract.createCategory, async ({ body }) => {
      const result = await this.categoryService.create({ name: body.name });
      return { status: 201, body: result };
    });
  }

  @TsRestHandler(contract.updateCategory)
  updateCategory(): TsRestHandler<typeof contract.updateCategory> {
    return tsRestHandler(contract.updateCategory, async ({ params, body }) => {
      const category = await this.categoryService.findByName(params.name);
      if (!category) {
        throw new NotFoundException(`Category ${params.name} not found`);
      }
      const result = await this.categoryService.update(category.id, body);
      return { status: 200, body: result };
    });
  }

  @TsRestHandler(contract.deleteCategory)
  deleteCategory(): TsRestHandler<typeof contract.deleteCategory> {
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
  getArticlesByCategory(): TsRestHandler<typeof contract.getArticlesByCategory> {
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
      return { status: 200, body: result.items };
    });
  }
}
