import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { timelineContract } from '@vanblog/shared/contracts';

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

  @TsRestHandler(timelineContract.getTimeline)
  @DerivedView({ key: 'timeline', ttl: 180, swr: true })
  @Get()
  getTimelineHandler(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(timelineContract.getTimeline, async ({ query }) => {
      const includeHidden = (query?.includeHidden ?? 'false') === 'true';
      const data = await this.timelineService.getTimeline(includeHidden);
      return { status: 200, body: data };
    });
  }
}
