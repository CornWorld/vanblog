import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { DerivedView } from '../../shared/decorators/derived-view.decorator';

import { TimelineQueryDto, TimelineResponseDto } from './dto/timeline.dto';
import { TimelineService } from './timeline.service';

@ApiTags('公共接口')
@Controller({ path: 'public', version: '2' })
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  @Get('timeline')
  @ApiOperation({ summary: '获取文章时间线' })
  @DerivedView({ key: 'timeline', ttl: 180, swr: true })
  async getTimeline(
    @Query() query: TimelineQueryDto,
  ): Promise<{ statusCode: number; data: TimelineResponseDto }> {
    const data = await this.timelineService.getTimeline(query.includeHidden);
    return { statusCode: 200, data };
  }
}
