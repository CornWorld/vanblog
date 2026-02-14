import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { DerivedView } from '../../shared/decorators/derived-view.decorator';

import { TimelineResponseDto } from './dto/timeline.dto';
import { TimelineService } from './timeline.service';

@ApiTags('Public')
@Controller({ path: 'public' })
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  @Get('timeline')
  @DerivedView({ key: 'timeline', ttl: 180, swr: true })
  @ApiOperation({ summary: 'Get public timeline grouped by year' })
  @ApiResponse({ status: 200, description: 'Timeline data grouped by year' })
  async getTimelineStd(
    @Query('includeHidden') includeHidden?: string,
  ): Promise<{ statusCode: number; data: TimelineResponseDto }> {
    const data = await this.timelineService.getTimeline(includeHidden === 'true');
    return { statusCode: 200, data };
  }
}
