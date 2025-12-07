import { Controller, Req } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@vanblog/shared';
import { Request } from 'express';

import { AnalyticsService } from './services/analytics.service';
import { PublicAnalyticsService } from './services/public-analytics.service';
import { ThirdPartyAnalyticsService } from './services/third-party-analytics.service';

@Controller()
export class AnalyticsTsRestController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly publicAnalyticsService: PublicAnalyticsService,
    private readonly thirdPartyAnalyticsService: ThirdPartyAnalyticsService,
  ) {}

  @TsRestHandler(contract.getPublicViewer)
  getPublicViewer(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getPublicViewer, async () => {
      const overview = await this.publicAnalyticsService.getPublicOverview();
      const totalPageviews = Number(
        (overview as unknown as { totalPageviews?: unknown }).totalPageviews ?? 0,
      );
      const totalVisitors = Number(
        (overview as unknown as { totalVisitors?: unknown }).totalVisitors ?? 0,
      );
      return { status: 200, body: { totalPageviews, totalVisitors } };
    });
  }

  @TsRestHandler(contract.getArticleViewer)
  getArticleViewer(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getArticleViewer, async ({ params }) => {
      const idNum = Number(params.id);
      const data = await this.publicAnalyticsService.getPublicArticleStats(idNum);
      if (!data) {
        return { status: 200, body: null };
      }
      const t = data as unknown as {
        articleId?: unknown;
        title?: unknown;
        views?: unknown;
        uniqueVisitors?: unknown;
        avgReadTime?: unknown;
      };
      return {
        status: 200,
        body: {
          articleId: Number(t.articleId ?? idNum),
          title: typeof t.title === 'string' ? t.title : '',
          views: Number(t.views ?? 0),
          uniqueVisitors: Number(t.uniqueVisitors ?? 0),
          avgReadTime: Number(t.avgReadTime ?? 0),
        },
      };
    });
  }

  @TsRestHandler(contract.recordPublicViewer)
  recordPublicViewer(@Req() req: Request): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.recordPublicViewer, async ({ body, headers }) => {
      const raw = body as unknown as {
        type?: unknown;
        path?: unknown;
        referrer?: unknown;
        userAgent?: unknown;
        data?: unknown;
      };
      const type = typeof raw.type === 'string' ? raw.type : '';
      const path = typeof raw.path === 'string' ? raw.path : undefined;
      const referrer = typeof raw.referrer === 'string' ? raw.referrer : undefined;
      const userAgentInBody = typeof raw.userAgent === 'string' ? raw.userAgent : undefined;
      const { data } = raw;
      const ip = typeof (req.ip as unknown) === 'string' ? req.ip : undefined;
      const headerUa =
        typeof headers['user-agent'] === 'string' ? headers['user-agent'] : undefined;
      const userAgent = userAgentInBody ?? headerUa;

      await this.analyticsService.recordAnalytics({
        type,
        path: path ?? null,
        referrer: referrer ?? null,
        userAgent: userAgent ?? null,
        ip: ip ?? null,
        data,
      });

      if (type === 'pageview' && typeof path === 'string') {
        await this.thirdPartyAnalyticsService.trackPageview(path, ip, userAgent);
      }
      return { status: 201, body: undefined };
    });
  }

  @TsRestHandler(contract.getAnalyticsOverview)
  getAnalyticsOverview(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getAnalyticsOverview, async () => {
      const overview = await this.analyticsService.getOverview();
      const t = overview as unknown as {
        totalPageviews?: unknown;
        totalVisitors?: unknown;
        todayPageviews?: unknown;
        todayVisitors?: unknown;
      };
      return {
        status: 200,
        body: {
          totalPageviews: Number(t.totalPageviews ?? 0),
          totalVisitors: Number(t.totalVisitors ?? 0),
          todayPageviews: Number(t.todayPageviews ?? 0),
          todayVisitors: Number(t.todayVisitors ?? 0),
        },
      };
    });
  }
}
