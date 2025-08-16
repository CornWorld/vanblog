import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { PublicMetaResponseDto } from './meta.dto';
import { MetaService } from './meta.service';

@ApiTags('公共接口')
@Controller({ path: 'public', version: '2' })
export class MetaController {
  constructor(private readonly metaService: MetaService) {}

  @Get('meta')
  @ApiOperation({ summary: '获取站点元数据' })
  async getMeta(): Promise<{ statusCode: number; data: PublicMetaResponseDto }> {
    const data = await this.metaService.getPublicMeta();
    return { statusCode: 200, data };
  }
}
