import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { StatisticsService } from '../../shared/services/statistics.service';
import { CategoryService } from '../category/category.service';
import { CommentService } from '../comment/comment.service';
import { RewardService } from '../reward/reward.service';
import { SettingCoreService, type Navigation } from '../setting/services/setting-core.service';
import { SocialLinksService } from '../social-links/social-links.service';
import { TagService } from '../tag/tag.service';

import type { PublicMetaResponseDto } from './meta.dto';

@Injectable()
export class MetaService {
  constructor(
    private readonly configService: ConfigService,
    private readonly statisticsService: StatisticsService,
    private readonly settingCoreService: SettingCoreService,
    private readonly socialLinksService: SocialLinksService,
    private readonly rewardService: RewardService,
    private readonly commentService: CommentService,
    private readonly tagService: TagService,
    private readonly categoryService: CategoryService,
  ) {}

  async getPublicMeta(): Promise<PublicMetaResponseDto> {
    const [
      tags,
      overall,
      siteInfo,
      navigation,
      friendLinks,
      socialLinks,
      rewards,
      walineSettings,
      categories,
    ] = await Promise.all([
      this.getAllTags(),
      this.statisticsService.getOverallStatistics(),
      this.settingCoreService.getSiteInfo(),
      this.settingCoreService.getNavigation(),
      this.settingCoreService.getFriendLinks(),
      this.socialLinksService.getSocialLinks(),
      this.rewardService.getRewardInfo(),
      this.getWalineConfig(),
      this.getAllCategories(),
    ]);

    const response: PublicMetaResponseDto = {
      version: this.getVersion(),
      tags,
      totalArticles: overall.publishedArticles,
      totalWordCount: 0,
      meta: {
        links: friendLinks.map((link) => ({
          name: link.name,
          desc: link.description ?? '',
          logo: link.avatar ?? '',
          url: link.url,
          updatedAt: new Date().toISOString(),
        })),
        socials: socialLinks.map((s) => ({
          type: s.type as 'bilibili' | 'email' | 'github' | 'wechat' | 'gitee' | 'wechat-dark',
          value: s.url,
          updatedAt: new Date().toISOString(),
        })),
        rewards: rewards.map((r) => ({
          name: r.name,
          value: r.value,
          updatedAt: new Date().toISOString(),
        })),
        categories,
        about: {
          updatedAt: new Date().toISOString(),
          content: '',
        },
        siteInfo: this.mapSiteInfoToLegacyFormat(siteInfo),
      },
      menus: this.mapNavigationToMenus(navigation),
      ...(walineSettings && { walineConfig: walineSettings }),
    } as unknown as PublicMetaResponseDto;

    return response;
  }

  private async getAllTags(): Promise<string[]> {
    const tagResponse = await this.tagService.findAll();
    return tagResponse.items.map((tag) => tag.name);
  }

  private async getAllCategories(): Promise<string[]> {
    const categoryResponse = await this.categoryService.findAll();
    return categoryResponse.items.map((category) => category.name);
  }

  private getVersion(): string {
    return this.configService.get<string>('APP_VERSION') ?? 'dev';
  }

  private async getWalineConfig(): Promise<{ serverURL?: string } | undefined> {
    try {
      const walineSettings = await this.commentService.getWalineSetting();
      return {
        serverURL: walineSettings.serverURL,
      };
    } catch {
      return undefined;
    }
  }

  private mapSiteInfoToLegacyFormat(siteInfo: unknown): Record<string, unknown> {
    const get = (obj: unknown, key: string): unknown => {
      if (obj !== null && typeof obj === 'object' && key in (obj as Record<string, unknown>)) {
        return (obj as Record<string, unknown>)[key];
      }
      return undefined;
    };

    const asString = (v: unknown): string | undefined => {
      if (typeof v === 'string') return v;
      if (typeof v === 'number' || typeof v === 'boolean') return String(v);
      return undefined;
    };

    const asBoolean = (v: unknown): boolean | undefined => {
      if (typeof v === 'boolean') return v;
      if (typeof v === 'string') return v === 'true' || v === '1';
      if (typeof v === 'number') return v !== 0;
      return undefined;
    };

    const asNumber = (v: unknown): number | undefined => {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string') {
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
      }
      return undefined;
    };

    const boolToTF = (v: boolean | undefined, fallback = false): 'true' | 'false' =>
      String(v ?? fallback) as 'true' | 'false';

    return {
      author: asString(get(siteInfo, 'author')) ?? '',
      authorDesc: asString(get(siteInfo, 'authorDescription')) ?? '',
      authorLogo: asString(get(siteInfo, 'authorAvatar')) ?? '',
      authorLogoDark: asString(get(siteInfo, 'authorAvatarDark')) ?? undefined,
      siteLogo: asString(get(siteInfo, 'siteLogo')) ?? '',
      siteLogoDark: asString(get(siteInfo, 'siteLogoDark')) ?? undefined,
      favicon: asString(get(siteInfo, 'favicon')) ?? '',
      siteName: asString(get(siteInfo, 'siteName')) ?? asString(get(siteInfo, 'title')) ?? '',
      siteDesc:
        asString(get(siteInfo, 'siteDescription')) ?? asString(get(siteInfo, 'description')) ?? '',
      beianNumber: asString(get(siteInfo, 'icpNumber')) ?? '',
      beianUrl: asString(get(siteInfo, 'icpUrl')) ?? '',
      gaBeianNumber: asString(get(siteInfo, 'gaBeianNumber')) ?? '',
      gaBeianUrl: asString(get(siteInfo, 'gaBeianUrl')) ?? '',
      gaBeianLogoUrl: asString(get(siteInfo, 'gaBeianLogoUrl')) ?? '',
      payAliPay: asString(get(siteInfo, 'alipayQr')) ?? '',
      payWechat: asString(get(siteInfo, 'wechatQr')) ?? '',
      payAliPayDark: asString(get(siteInfo, 'alipayQrDark')) ?? undefined,
      payWechatDark: asString(get(siteInfo, 'wechatQrDark')) ?? undefined,
      since: asString(get(siteInfo, 'since')) ?? '',
      baseUrl: asString(get(siteInfo, 'baseUrl')) ?? '',
      baiduAnalysisId: asString(get(siteInfo, 'baiduAnalyticsId')) ?? undefined,
      gaAnalysisId: asString(get(siteInfo, 'googleAnalyticsId')) ?? undefined,
      copyrightAggreement: asString(get(siteInfo, 'copyrightStatement')) ?? '',
      showSubMenu: boolToTF(asBoolean(get(siteInfo, 'showSubMenu')), false),
      showAdminButton: boolToTF(asBoolean(get(siteInfo, 'showAdminButton')), false),
      headerLeftContent: (asString(get(siteInfo, 'headerLeftContent')) ?? 'siteName') as
        | 'siteLogo'
        | 'siteName',
      subMenuOffset: asNumber(get(siteInfo, 'subMenuOffset')) ?? 0,
      showDonateInfo: boolToTF(asBoolean(get(siteInfo, 'showDonateInfo')), false),
      showFriends: boolToTF(asBoolean(get(siteInfo, 'showFriends')), false),
      enableComment: boolToTF(asBoolean(get(siteInfo, 'enableComment')), false),
      defaultTheme: (asString(get(siteInfo, 'defaultTheme')) ?? 'auto') as
        | 'auto'
        | 'light'
        | 'dark',
      showDonateInAbout: boolToTF(asBoolean(get(siteInfo, 'showDonateInAbout')), false),
      enableCustomizing: boolToTF(asBoolean(get(siteInfo, 'enableCustomizing')), false),
      showDonateButton: boolToTF(asBoolean(get(siteInfo, 'showDonateButton')), false),
      showCopyRight: boolToTF(asBoolean(get(siteInfo, 'showCopyRight')), false),
      showRSS: boolToTF(asBoolean(get(siteInfo, 'showRSS')), false),
      openArticleLinksInNewWindow: boolToTF(
        asBoolean(get(siteInfo, 'openArticleLinksInNewWindow')),
        false,
      ),
      showExpirationReminder: boolToTF(asBoolean(get(siteInfo, 'showExpirationReminder')), false),
      showEditButton: boolToTF(asBoolean(get(siteInfo, 'showEditButton')), false),
    } as Record<string, unknown>;
  }

  private mapNavigationToMenus(navigation: Navigation[]): Array<Record<string, unknown>> {
    return navigation.map((item, index) => ({
      id: index,
      name: item.name,
      value: item.path,
      level: 0,
    }));
  }
}
