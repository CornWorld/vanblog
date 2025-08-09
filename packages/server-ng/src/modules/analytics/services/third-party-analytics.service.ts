import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import dayjs from 'dayjs';

@Injectable()
export class ThirdPartyAnalyticsService {
  private readonly googleAnalyticsUrl = 'https://www.google-analytics.com/collect';
  private readonly baiduUrl = 'https://hm.baidu.com/hm.gif';
  private readonly googleTrackingId: string | undefined;
  private readonly baiduSiteId: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.googleTrackingId = this.configService.get<string>('GOOGLE_ANALYTICS_ID');
    this.baiduSiteId = this.configService.get<string>('BAIDU_ANALYTICS_ID');
  }

  async trackPageview(path: string, ip?: string, userAgent?: string): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.googleTrackingId) {
      promises.push(
        this.sendToGoogleAnalytics({
          v: '1',
          tid: this.googleTrackingId,
          cid: this.generateClientId(ip),
          t: 'pageview',
          dp: path,
          uip: ip ?? '',
          ua: userAgent ?? '',
        }),
      );
    }

    if (this.baiduSiteId) {
      promises.push(
        this.sendToBaiduAnalytics({
          si: this.baiduSiteId,
          su: path,
          r: '',
        }),
      );
    }

    await Promise.allSettled(promises);
  }

  async trackEvent(
    category: string,
    action: string,
    label?: string,
    value?: number,
  ): Promise<void> {
    if (!this.googleTrackingId) {
      return;
    }

    await this.sendToGoogleAnalytics({
      v: '1',
      tid: this.googleTrackingId,
      cid: this.generateClientId(),
      t: 'event',
      ec: category,
      ea: action,
      el: label ?? '',
      ev: value?.toString() ?? '',
    });
  }

  async trackArticleView(articleId: number, articleTitle: string, ip?: string): Promise<void> {
    await this.trackEvent('Article', 'View', articleTitle, articleId);
    await this.trackPageview(`/article/${articleId.toString()}`, ip);
  }

  private async sendToGoogleAnalytics(payload: Record<string, string>): Promise<void> {
    try {
      await axios.post(this.googleAnalyticsUrl, null, {
        params: payload,
        timeout: 5000,
      });
    } catch {
      // Log error in production logging system instead of console
    }
  }

  private async sendToBaiduAnalytics(payload: Record<string, string>): Promise<void> {
    try {
      await axios.get(this.baiduUrl, {
        params: payload,
        timeout: 5000,
      });
    } catch {
      // Log error in production logging system instead of console
    }
  }

  private generateClientId(ip?: string): string {
    // Generate a simple client ID based on IP or random value
    if (ip) {
      return Buffer.from(ip).toString('base64').replace(/=/g, '');
    }
    return Math.random().toString(36).substring(2) + dayjs().valueOf().toString(36);
  }
}
