import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateCategoryDto, UpdateCategoryDto } from 'src/types/article/category.dto';
import { AdminGuard } from '../../auth/guard/auth.guard';
import { CategoryProvider } from '../provider/category.provider';
import { ISRProvider } from '../../isr/provider/isr.provider';
import { config } from 'src/common/config';
import { ApiToken } from 'src/common/swagger/token';
import { Result } from 'src/common/result/Result';

@ApiTags('category')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/category/')
export class CategoryController {
  constructor(
    private readonly categoryProvider: CategoryProvider,
    private readonly isrProvider: ISRProvider,
  ) { }

  @Get('/all')
  async getAllTags(@Query('detail') withDetail?: string) {
    let withAllData = false;
    if (withDetail && withDetail == 'true') withAllData = true;
    const data = await this.categoryProvider.getAllCategories(withAllData);
    return Result.ok(data).toObject();
  }

  @Get('/:name')
  async getArticlesByName(@Param('name') name: string) {
    const data = await this.categoryProvider.getArticlesByCategory(name, true);
    return Result.ok(data).toObject();
  }

  @Post()
  async createCategory(@Body() body: CreateCategoryDto) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, '演示站禁止修改此项！').toObject()
    }
    const data = await this.categoryProvider.addOne(body.name);
    this.isrProvider.activeAll('创建分类触发增量渲染！');
    return Result.ok(data).toObject();
  }

  @Delete('/:name')
  async deleteCategory(@Param('name') name: string) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, '演示站禁止修改此项！').toObject()
    }
    const data = await this.categoryProvider.deleteOne(name);
    this.isrProvider.activeAll('删除分类触发增量渲染！');
    return Result.ok(data).toObject();
  }

  @Put('/:name')
  async updateCategoryByName(@Param('name') name: string, @Body() updateDto: UpdateCategoryDto) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, '演示站禁止修改此项！').toObject();
    }
    const data = await this.categoryProvider.updateCategoryByName(name, updateDto);
    this.isrProvider.activeAll('更新分类触发增量渲染！');
    return Result.ok(data).toObject();
  }
}
