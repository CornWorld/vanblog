import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  forwardRef,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { customPages } from '@vanblog/shared/drizzle';
import { eq } from 'drizzle-orm';

import { DATABASE_CONNECTION, type Database } from '../../database';
import { MarkdownService } from '../../shared/services/markdown.service';
import { Perm } from '../auth/permissions.decorator';

@ApiTags('Custom Pages (Admin)')
@Controller({ path: 'custom-pages', version: '2' })
export class CustomPagesAdminController {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    @Inject(forwardRef(() => MarkdownService))
    private readonly markdownService: MarkdownService,
  ) {}

  /**
   * Get all custom pages (admin endpoint)
   */
  @Get('all')
  @Perm('setting', ['read'])
  @ApiOperation({ summary: 'Get all custom pages' })
  @ApiResponse({ status: 200, description: 'List of custom pages' })
  async getAllCustomPages(): Promise<Array<{ name: string; path: string; html: string }>> {
    const pages = await this.db
      .select({
        name: customPages.title,
        path: customPages.pathname,
        content: customPages.content,
        type: customPages.type,
      })
      .from(customPages);

    return pages.map((page) => ({
      name: page.name,
      path: page.path,
      html:
        page.type === 'markdown' ? this.markdownService.renderMarkdown(page.content) : page.content,
    }));
  }

  @Perm('setting', ['read'])
  @Get()
  async getCustomPages(): Promise<Array<{ name: string; path: string }>> {
    const pages = await this.db
      .select({
        name: customPages.title,
        path: customPages.pathname,
      })
      .from(customPages);
    return pages;
  }

  @Perm('setting', ['read'])
  @Get(':path')
  async getCustomPage(
    @Param('path') pagePath: string,
  ): Promise<{ name: string; path: string; html: string }> {
    const pageResult = await this.db
      .select({
        title: customPages.title,
        pathname: customPages.pathname,
        content: customPages.content,
        type: customPages.type,
      })
      .from(customPages)
      .where(eq(customPages.pathname, pagePath))
      .limit(1);

    if (pageResult.length === 0) {
      throw new Error('Custom page not found');
    }

    const [page] = pageResult;

    const html =
      page.type === 'markdown' ? this.markdownService.renderMarkdown(page.content) : page.content;

    return { name: page.title, path: page.pathname, html };
  }

  @Perm('setting', ['update'])
  @Post()
  @HttpCode(201)
  createCustomPage(): { name: string; path: string; html: string } {
    // Implementation needed - this is a stub
    return { name: '', path: '', html: '' };
  }

  @Perm('setting', ['update'])
  @Put(':path')
  updateCustomPage(@Param('path') _pagePath: string): { name: string; path: string; html: string } {
    // Implementation needed - this is a stub
    return { name: '', path: '', html: '' };
  }

  @Perm('setting', ['update'])
  @Delete(':path')
  deleteCustomPage(@Param('path') _pagePath: string): { success: boolean } {
    // Implementation needed - this is a stub
    return { success: true };
  }
}
