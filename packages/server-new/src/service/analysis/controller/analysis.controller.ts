import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../auth/guard/auth.guard';
import { AnalysisProvider, WelcomeTab } from '../provider/analysis.provider';
import { ApiToken } from '../../../common/swagger/token';
import { Result } from 'src/common/result/Result';

@ApiTags('analysis')
@ApiToken
@UseGuards(...AdminGuard)
@Controller('/api/admin/analysis')
export class AnalysisController {
  constructor(private readonly analysisProvider: AnalysisProvider) { }

  @Get()
  async getWelcomePageData(
    @Query('tab') tab: WelcomeTab,
    @Query('viewerDataNum') viewerDataNum: string = '5',
    @Query('overviewDataNum') overviewDataNum: string = '5',
    @Query('articleTabDataNum') articleTabDataNum: string = '5',
  ) {
    const data = await this.analysisProvider.getWelcomePageData(
      tab,
      parseInt(overviewDataNum, 10),
      parseInt(viewerDataNum, 10),
      parseInt(articleTabDataNum, 10),
    );
    return Result.ok(data).toObject();
  }
}
