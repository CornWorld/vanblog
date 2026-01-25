import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Perm } from '../auth/permissions.decorator';

@ApiTags('Articles')
@Controller({ path: 'admin/articles-alias', version: '2' })
export class AdminArticleAliasController {
  @Get('health')
  @Perm('article', ['read'])
  @ApiOperation({ summary: 'Alias controller health check' })
  @ApiResponse({ status: 200, description: 'Alias controller is healthy' })
  health(): { status: 'ok' } {
    return { status: 'ok' } as const;
  }
}
