import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Perm } from '../auth/permissions.decorator';

import { CustomPagesService, type CustomPageResponse } from './services/custom-pages.service';

@ApiTags('Custom Pages (Admin)')
@Controller({ path: 'custom-pages', version: '2' })
export class CustomPagesAdminController {
  constructor(private readonly customPagesService: CustomPagesService) {}

  /**
   * Get all custom pages (admin endpoint)
   */
  @Get('all')
  @Perm('setting', ['read'])
  @ApiOperation({ summary: 'Get all custom pages' })
  @ApiResponse({ status: 200, description: 'List of custom pages' })
  async getAllCustomPages(): Promise<CustomPageResponse[]> {
    return this.customPagesService.getAllCustomPages();
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
    return this.customPagesService.getCustomPageByPath(pagePath);
  }

  @Perm('setting', ['update'])
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create custom page' })
  @ApiResponse({ status: 201, description: 'Custom page created' })
  async createCustomPage(
    @Body() body: { name: string; path: string },
  ): Promise<CustomPageResponse> {
    return this.customPagesService.createCustomPage(body.name, body.path);
  }

  @Perm('setting', ['update'])
  @Put()
  @ApiOperation({ summary: 'Update custom page' })
  @ApiResponse({ status: 200, description: 'Custom page updated' })
  @ApiResponse({ status: 404, description: 'Custom page not found' })
  async updateCustomPage(
    @Body() body: { id: string; name?: string; path?: string },
  ): Promise<CustomPageResponse> {
    return this.customPagesService.updateCustomPage(body.id, {
      name: body.name,
      path: body.path,
    });
  }

  @Perm('setting', ['update'])
  @Delete()
  @ApiOperation({ summary: 'Delete custom page' })
  @ApiResponse({ status: 200, description: 'Custom page deleted' })
  async deleteCustomPage(@Query('path') pagePath: string): Promise<{ success: boolean }> {
    if (!pagePath) {
      throw new NotFoundException('Path query parameter is required');
    }
    await this.customPagesService.deleteCustomPage(pagePath);
    return { success: true };
  }

  /**
   * Get custom page folder tree
   *
   * In the current server-ng data model, custom pages are stored in the database
   * rather than as filesystem folders. This endpoint returns an empty array
   * to maintain API compatibility with the admin frontend.
   */
  @Get('folder')
  @Perm('setting', ['read'])
  @ApiOperation({ summary: 'Get custom page folder tree' })
  @ApiResponse({ status: 200, description: 'Folder tree structure' })
  getCustomPageFolder(@Query('path') _pagePath: string): unknown[] {
    return [];
  }

  /**
   * Get custom page file content
   *
   * In server-ng, custom pages are stored in the database as a single content field.
   * Returns the page content to maintain API compatibility with the admin Code editor page.
   */
  @Get('file')
  @Perm('setting', ['read'])
  @ApiOperation({ summary: 'Get custom page file content' })
  @ApiResponse({ status: 200, description: 'File content' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async getCustomPageFile(
    @Query('path') pagePath: string,
    @Query('key') _key: string,
  ): Promise<string> {
    if (!pagePath) {
      throw new NotFoundException('Path query parameter is required');
    }
    return this.customPagesService.getCustomPageContent(pagePath);
  }

  /**
   * Create custom page file/folder
   *
   * Stub endpoint for API compatibility. In server-ng, custom pages don't use
   * filesystem-based file management.
   */
  @Post('file')
  @Perm('setting', ['update'])
  @HttpCode(201)
  @ApiOperation({ summary: 'Create custom page file/folder' })
  @ApiResponse({ status: 201, description: 'File created' })
  createCustomPageFile(
    @Query('path') _pagePath: string,
    @Query('subPath') _subPath: string,
  ): { success: boolean } {
    return { success: true };
  }

  /**
   * Update custom page file content
   *
   * Updates the page content in the database.
   */
  @Put('file')
  @Perm('setting', ['update'])
  @ApiOperation({ summary: 'Update custom page file content' })
  @ApiResponse({ status: 200, description: 'File updated' })
  @ApiResponse({ status: 404, description: 'Custom page not found' })
  async updateCustomPageFile(
    @Body() body: { pathname: string; filePath: string; content: string },
  ): Promise<{ success: boolean }> {
    await this.customPagesService.updateCustomPageContent(body.pathname, body.content);
    return { success: true };
  }
}
