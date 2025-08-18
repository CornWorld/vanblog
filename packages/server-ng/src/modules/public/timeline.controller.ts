import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';

import { DerivedView } from '../../shared/decorators/derived-view.decorator';

import { TimelineQueryDto, TimelineResponseDto } from './dto/timeline.dto';
import { TimelineService } from './timeline.service';

@ApiTags('Public')
@Controller({ path: 'public', version: '2' })
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  @Get('timeline')
  @ApiOperation({ summary: '获取文章时间线' })
  @ApiResponse({
    status: 200,
    description: '文章时间线获取成功',
    type: Object,
  })
  @DerivedView({ key: 'timeline', ttl: 180, swr: true })
  async getTimeline(
    @Query() query: TimelineQueryDto,
  ): Promise<{ statusCode: number; data: TimelineResponseDto }> {
    const data = await this.timelineService.getTimeline(query.includeHidden);
    return { statusCode: 200, data };
  }
}
