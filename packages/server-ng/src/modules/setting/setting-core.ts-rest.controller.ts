import { Controller } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract, NavigationItem } from '@vanblog/shared';

import {
  SettingCoreService,
  SiteInfo,
  SiteTheme,
  Navigation,
} from './services/setting-core.service';

@Controller()
export class SettingCoreTsRestController {
  constructor(private readonly settingCoreService: SettingCoreService) {}

  @TsRestHandler(contract.getSiteInfo)
  getSiteInfo(): TsRestHandler<typeof contract.getSiteInfo> {
    return tsRestHandler(contract.getSiteInfo, async () => {
      const data = await this.settingCoreService.getSiteInfo();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateSiteInfo)
  updateSiteInfo(): TsRestHandler<typeof contract.updateSiteInfo> {
    return tsRestHandler(contract.updateSiteInfo, async ({ body }) => {
      const siteInfoUpdate: Partial<SiteInfo> = {
        title: body.siteName,
        description: body.siteDescription ?? '',
        author: body.authorName ?? '',
        keywords: body.siteKeywords ? body.siteKeywords.split(',').map((k) => k.trim()) : [],
      };
      const data = await this.settingCoreService.updateSiteInfo(siteInfoUpdate);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getLayoutSettings)
  getLayoutSettings(): TsRestHandler<typeof contract.getLayoutSettings> {
    return tsRestHandler(contract.getLayoutSettings, async () => {
      const data = await this.settingCoreService.getLayoutSettings();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateLayoutSettings)
  updateLayoutSettings(): TsRestHandler<typeof contract.updateLayoutSettings> {
    return tsRestHandler(contract.updateLayoutSettings, async ({ body }) => {
      const data = await this.settingCoreService.updateLayoutSettings(body);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getThemeSettings)
  getThemeSettings(): TsRestHandler<typeof contract.getThemeSettings> {
    return tsRestHandler(contract.getThemeSettings, async () => {
      const data = await this.settingCoreService.getThemeSettings();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateThemeSettings)
  updateThemeSettings(): TsRestHandler<typeof contract.updateThemeSettings> {
    return tsRestHandler(contract.updateThemeSettings, async ({ body }) => {
      const themeUpdate: Partial<SiteTheme> = {
        primaryColor: body.theme !== '' ? body.theme : '#000000',
        darkMode: false,
      };
      const data = await this.settingCoreService.updateThemeSettings(themeUpdate);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getFriendLinks)
  getFriendLinks(): TsRestHandler<typeof contract.getFriendLinks> {
    return tsRestHandler(contract.getFriendLinks, async () => {
      const data = await this.settingCoreService.getFriendLinks();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.createFriendLink)
  createFriendLink(): TsRestHandler<typeof contract.createFriendLink> {
    return tsRestHandler(contract.createFriendLink, async ({ body }) => {
      const data = await this.settingCoreService.createFriendLink({
        name: body.name,
        url: body.url,
        description: body.description,
        avatar: body.avatar,
      });
      return { status: 201, body: data };
    });
  }

  @TsRestHandler(contract.updateFriendLink)
  updateFriendLink(): TsRestHandler<typeof contract.updateFriendLink> {
    return tsRestHandler(contract.updateFriendLink, async ({ params, body }) => {
      const index = params.index ?? -1;
      const data = await this.settingCoreService.updateFriendLink(index, body);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.deleteFriendLink)
  deleteFriendLink(): TsRestHandler<typeof contract.deleteFriendLink> {
    return tsRestHandler(contract.deleteFriendLink, async ({ params }) => {
      const index = params.index ?? -1;
      const data = await this.settingCoreService.deleteFriendLink(index);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getNavigation)
  getNavigation(): TsRestHandler<typeof contract.getNavigation> {
    return tsRestHandler(contract.getNavigation, async () => {
      const data = await this.settingCoreService.getNavigation();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateNavigation)
  updateNavigation(): TsRestHandler<typeof contract.updateNavigation> {
    return tsRestHandler(contract.updateNavigation, async ({ body }) => {
      const mapItem = (item: NavigationItem): Navigation => ({
        name: item.name,
        path: item.url,
        icon: item.icon,
        external: item.target === '_blank',
        children: item.children?.map(mapItem),
      });

      const navigationItems = (body.items ?? []).map(mapItem);
      const data = await this.settingCoreService.updateNavigation(navigationItems);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getCustomCode)
  getCustomCode(): TsRestHandler<typeof contract.getCustomCode> {
    return tsRestHandler(contract.getCustomCode, async () => {
      const data = await this.settingCoreService.getCustomCode();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateCustomCode)
  updateCustomCode(): TsRestHandler<typeof contract.updateCustomCode> {
    return tsRestHandler(contract.updateCustomCode, async ({ body }) => {
      const data = await this.settingCoreService.updateCustomCode(body);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getAboutInfo)
  getAboutInfo(): TsRestHandler<typeof contract.getAboutInfo> {
    return tsRestHandler(contract.getAboutInfo, async () => {
      const data = await this.settingCoreService.getAboutInfo();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateAboutInfo)
  updateAboutInfo(): TsRestHandler<typeof contract.updateAboutInfo> {
    return tsRestHandler(contract.updateAboutInfo, async ({ body }) => {
      const data = await this.settingCoreService.updateAboutInfo(body);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getSocials)
  getSocials(): TsRestHandler<typeof contract.getSocials> {
    return tsRestHandler(contract.getSocials, async () => {
      const data = await this.settingCoreService.getSocials();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateSocial)
  updateSocial(): TsRestHandler<typeof contract.updateSocial> {
    return tsRestHandler(contract.updateSocial, async ({ body }) => {
      const data = await this.settingCoreService.updateSocial({
        type: body.type,
        value: body.value,
      });
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.deleteSocial)
  deleteSocial(): TsRestHandler<typeof contract.deleteSocial> {
    return tsRestHandler(contract.deleteSocial, async ({ params }) => {
      const data = await this.settingCoreService.deleteSocial(params.type);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getSocialTypes)
  getSocialTypes(): TsRestHandler<typeof contract.getSocialTypes> {
    return tsRestHandler(contract.getSocialTypes, () => {
      const data = this.settingCoreService.getSocialTypes();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getWalineSetting)
  getWalineSetting(): TsRestHandler<typeof contract.getWalineSetting> {
    return tsRestHandler(contract.getWalineSetting, async () => {
      const data = await this.settingCoreService.getWalineSetting();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateWalineSetting)
  updateWalineSetting(): TsRestHandler<typeof contract.updateWalineSetting> {
    return tsRestHandler(contract.updateWalineSetting, async ({ body }) => {
      const data = await this.settingCoreService.updateWalineSetting(body);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getISRSetting)
  getISRSetting(): TsRestHandler<typeof contract.getISRSetting> {
    return tsRestHandler(contract.getISRSetting, async () => {
      const data = await this.settingCoreService.getISRSetting();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateISRSetting)
  updateISRSetting(): TsRestHandler<typeof contract.updateISRSetting> {
    return tsRestHandler(contract.updateISRSetting, async ({ body }) => {
      const data = await this.settingCoreService.updateISRSetting(body);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getLoginSetting)
  getLoginSetting(): TsRestHandler<typeof contract.getLoginSetting> {
    return tsRestHandler(contract.getLoginSetting, async () => {
      const data = await this.settingCoreService.getLoginSetting();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateLoginSetting)
  updateLoginSetting(): TsRestHandler<typeof contract.updateLoginSetting> {
    return tsRestHandler(contract.updateLoginSetting, async ({ body }) => {
      const data = await this.settingCoreService.updateLoginSetting(body);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getHttpsSetting)
  getHttpsSetting(): TsRestHandler<typeof contract.getHttpsSetting> {
    return tsRestHandler(contract.getHttpsSetting, async () => {
      const data = await this.settingCoreService.getHttpsSetting();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateHttpsSetting)
  updateHttpsSetting(): TsRestHandler<typeof contract.updateHttpsSetting> {
    return tsRestHandler(contract.updateHttpsSetting, async ({ body }) => {
      const data = await this.settingCoreService.updateHttpsSetting({
        redirect: body.redirect ?? false,
      });
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getStaticSetting)
  getStaticSetting(): TsRestHandler<typeof contract.getStaticSetting> {
    return tsRestHandler(contract.getStaticSetting, async () => {
      const data = await this.settingCoreService.getStaticSetting();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateStaticSetting)
  updateStaticSetting(): TsRestHandler<typeof contract.updateStaticSetting> {
    return tsRestHandler(contract.updateStaticSetting, async ({ body }) => {
      const data = await this.settingCoreService.updateStaticSetting({
        storageType: body.storageType ?? 'local',
        picgoConfig: body.picgoConfig,
        picgoPlugins: body.picgoPlugins,
        enableWaterMark: body.enableWaterMark ?? false,
        waterMarkText: body.waterMarkText,
        enableWebp: body.enableWebp ?? true,
      });
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getRewards)
  getRewards(): TsRestHandler<typeof contract.getRewards> {
    return tsRestHandler(contract.getRewards, async () => {
      const data = await this.settingCoreService.getRewards();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.createReward)
  createReward(): TsRestHandler<typeof contract.createReward> {
    return tsRestHandler(contract.createReward, async ({ body }) => {
      const data = await this.settingCoreService.createReward({
        name: body.name,
        value: body.value,
      });
      return { status: 201, body: data };
    });
  }

  @TsRestHandler(contract.updateReward)
  updateReward(): TsRestHandler<typeof contract.updateReward> {
    return tsRestHandler(contract.updateReward, async ({ params, body }) => {
      const data = await this.settingCoreService.updateReward(params.name, {
        name: body.name,
        value: body.value,
      });
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.deleteReward)
  deleteReward(): TsRestHandler<typeof contract.deleteReward> {
    return tsRestHandler(contract.deleteReward, async ({ params }) => {
      const data = await this.settingCoreService.deleteReward(params.name);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getCaddyLog)
  getCaddyLog(): TsRestHandler<typeof contract.getCaddyLog> {
    return tsRestHandler(contract.getCaddyLog, () => {
      const data = this.settingCoreService.getCaddyLog();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.clearCaddyLog)
  clearCaddyLog(): TsRestHandler<typeof contract.clearCaddyLog> {
    return tsRestHandler(contract.clearCaddyLog, () => {
      this.settingCoreService.clearCaddyLog();
      return { status: 200, body: 'Logs cleared' };
    });
  }

  @TsRestHandler(contract.getCaddyConfig)
  getCaddyConfig(): TsRestHandler<typeof contract.getCaddyConfig> {
    return tsRestHandler(contract.getCaddyConfig, async () => {
      const data = await this.settingCoreService.getCaddyConfig();
      return { status: 200, body: JSON.stringify(data) };
    });
  }
}
