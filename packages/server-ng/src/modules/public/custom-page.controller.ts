import { Controller, Get, Query, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { CustomPageService } from './custom-page.service';

interface CustomPageList {
  name: string;
  path: string;
}

interface CustomPage extends CustomPageList {
  html: string;
}

@ApiTags('Public Custom Pages')
@Controller({ path: 'public', version: '2' })
export class CustomPageController {
  constructor(private readonly customPageService: CustomPageService) {}

  @Get('customPage/all')
  @ApiOperation({ summary: 'Get all custom pages' })
  @ApiResponse({ status: 200, description: 'Return all custom pages' })
  async getAllCustomPages(): Promise<{ statusCode: number; data: CustomPageList[] }> {
    const customPages = await this.customPageService.getAllCustomPages();
    return {
      statusCode: 200,
      data: customPages,
    };
  }

  @Get('customPage')
  @ApiOperation({ summary: 'Get a specific custom page by path' })
  @ApiResponse({ status: 200, description: 'Return the custom page' })
  @ApiResponse({ status: 404, description: 'Custom page not found' })
  async getCustomPage(
    @Query('path') path: string,
  ): Promise<{ statusCode: number; data: CustomPage }> {
    if (typeof path !== 'string' || path === '') {
      throw new NotFoundException('Path parameter is required');
    }

    const customPage = await this.customPageService.getCustomPageByPath(path);
    if (!customPage) {
      throw new NotFoundException(`Custom page not found for path: ${path}`);
    }

    return {
      statusCode: 200,
      data: customPage,
    };
  }
}
