import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { customPages } from '@vanblog/shared/drizzle';
import { eq } from 'drizzle-orm';

import { DATABASE_CONNECTION, type Database } from '../../database';
import { Perm } from '../auth/permissions.decorator';

interface CustomPageResponse {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  updatedAt: string;
}

@ApiTags('Custom Pages (Admin)')
@Controller({ path: 'custom-pages', version: '2' })
export class CustomPagesAdminController {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  /**
   * Get all custom pages (admin endpoint)
   */
  @Get('all')
  @Perm('setting', ['read'])
  @ApiOperation({ summary: 'Get all custom pages' })
  @ApiResponse({ status: 200, description: 'List of custom pages' })
  async getAllCustomPages(): Promise<CustomPageResponse[]> {
    const pages = await this.db
      .select({
        id: customPages.id,
        name: customPages.title,
        path: customPages.pathname,
        createdAt: customPages.createdAt,
        updatedAt: customPages.updatedAt,
      })
      .from(customPages);

    return pages.map((page) => ({
      id: String(page.id),
      name: page.name,
      path: page.path,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    }));
  }

  @Perm('setting', ['read'])
  @Get()
  @ApiOperation({ summary: 'Get custom page by path' })
  @ApiResponse({ status: 200, description: 'Custom page details' })
  @ApiResponse({ status: 404, description: 'Custom page not found' })
  async getCustomPage(@Query('path') pagePath: string): Promise<CustomPageResponse> {
    if (!pagePath) {
      throw new NotFoundException('Path query parameter is required');
    }

    const pageResult = await this.db
      .select({
        id: customPages.id,
        title: customPages.title,
        pathname: customPages.pathname,
        createdAt: customPages.createdAt,
        updatedAt: customPages.updatedAt,
      })
      .from(customPages)
      .where(eq(customPages.pathname, pagePath))
      .limit(1);

    if (pageResult.length === 0) {
      throw new NotFoundException(`Custom page not found for path: ${pagePath}`);
    }

    const [page] = pageResult;

    return {
      id: String(page.id),
      name: page.title,
      path: page.pathname,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    };
  }

  @Perm('setting', ['update'])
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create custom page' })
  @ApiResponse({ status: 201, description: 'Custom page created' })
  async createCustomPage(
    @Body() body: { name: string; path: string },
  ): Promise<CustomPageResponse> {
    const result = await this.db
      .insert(customPages)
      .values({
        title: body.name,
        pathname: body.path,
        content: '',
      })
      .returning({
        id: customPages.id,
        name: customPages.title,
        path: customPages.pathname,
        createdAt: customPages.createdAt,
        updatedAt: customPages.updatedAt,
      });

    const [page] = result;

    return {
      id: String(page.id),
      name: page.name,
      path: page.path,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    };
  }

  @Perm('setting', ['update'])
  @Put()
  @ApiOperation({ summary: 'Update custom page' })
  @ApiResponse({ status: 200, description: 'Custom page updated' })
  @ApiResponse({ status: 404, description: 'Custom page not found' })
  async updateCustomPage(
    @Body() body: { id: string; name?: string; path?: string },
  ): Promise<CustomPageResponse> {
    const updateData: Record<string, string> = {};
    if (body.name !== undefined) {
      updateData['title'] = body.name;
    }
    if (body.path !== undefined) {
      updateData['pathname'] = body.path;
    }

    const result = await this.db
      .update(customPages)
      .set(updateData)
      .where(eq(customPages.id, Number(body.id)))
      .returning({
        id: customPages.id,
        name: customPages.title,
        path: customPages.pathname,
        createdAt: customPages.createdAt,
        updatedAt: customPages.updatedAt,
      });

    if (result.length === 0) {
      throw new NotFoundException(`Custom page not found for id: ${body.id}`);
    }

    const [page] = result;

    return {
      id: String(page.id),
      name: page.name,
      path: page.path,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    };
  }

  @Perm('setting', ['update'])
  @Delete()
  @ApiOperation({ summary: 'Delete custom page' })
  @ApiResponse({ status: 200, description: 'Custom page deleted' })
  async deleteCustomPage(@Query('path') pagePath: string): Promise<{ success: boolean }> {
    if (!pagePath) {
      throw new NotFoundException('Path query parameter is required');
    }

    await this.db.delete(customPages).where(eq(customPages.pathname, pagePath));

    return { success: true };
  }
}
