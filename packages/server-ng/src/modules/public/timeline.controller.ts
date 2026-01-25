import { Controller } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { timelineContract } from '@vanblog/shared/contracts';

import { DerivedView } from '../../shared/decorators/derived-view.decorator';

import { TimelineResponseDto } from './dto/timeline.dto';
import { TimelineService } from './timeline.service';

@Controller()
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  @TsRestHandler(timelineContract.getTimeline)
  @DerivedView({ key: 'timeline', ttl: 180, swr: true })
  getTimelineHandler(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(timelineContract.getTimeline, async ({ query }) => {
      const includeHidden = (query?.includeHidden ?? 'false') === 'true';
      const data = await this.timelineService.getTimeline(includeHidden);
      return { status: 200, body: data };
    });
  }

  async getTimeline(query: {
    includeHidden?: boolean;
  }): Promise<{ statusCode: number; data: TimelineResponseDto }> {
    const data = await this.timelineService.getTimeline(Boolean(query.includeHidden));
    return { statusCode: 200, data };
  }
}
