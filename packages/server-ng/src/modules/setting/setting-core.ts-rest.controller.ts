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
  getSiteInfo(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getSiteInfo, async () => {
      const data = await this.settingCoreService.getSiteInfo();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateSiteInfo)
  updateSiteInfo(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateSiteInfo, async ({ body }) => {
      const siteInfoUpdate: Partial<SiteInfo> = {
        title: body.siteName,
        description: body.siteDescription ?? '',
        author: body.authorName ?? '',
        keywords: body.siteKeywords
          ? body.siteKeywords.split(',').map((k: string) => k.trim())
          : [],
      };
      const data = await this.settingCoreService.updateSiteInfo(siteInfoUpdate);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getLayoutSettings)
  getLayoutSettings(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getLayoutSettings, async () => {
      const data = await this.settingCoreService.getLayoutSettings();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateLayoutSettings)
  updateLayoutSettings(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateLayoutSettings, async ({ body }) => {
      const data = await this.settingCoreService.updateLayoutSettings(body);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getThemeSettings)
  getThemeSettings(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getThemeSettings, async () => {
      const data = await this.settingCoreService.getThemeSettings();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateThemeSettings)
  updateThemeSettings(): ReturnType<typeof tsRestHandler> {
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
  getFriendLinks(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getFriendLinks, async () => {
      const data = await this.settingCoreService.getFriendLinks();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.createFriendLink)
  createFriendLink(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.createFriendLink, async ({ body }) => {
      const data = await this.settingCoreService.createFriendLink({
        name: String(body.name ?? ''),
        url: String(body.url ?? ''),
        description: body.description,
        avatar: body.avatar,
      });
      return { status: 201, body: data };
    });
  }

  @TsRestHandler(contract.updateFriendLink)
  updateFriendLink(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateFriendLink, async ({ params, body }) => {
      const index = params.index ?? -1;
      const data = await this.settingCoreService.updateFriendLink(index, body);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.deleteFriendLink)
  deleteFriendLink(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.deleteFriendLink, async ({ params }) => {
      const index = params.index ?? -1;
      const data = await this.settingCoreService.deleteFriendLink(index);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getNavigation)
  getNavigation(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getNavigation, async () => {
      const data = await this.settingCoreService.getNavigation();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateNavigation)
  updateNavigation(): ReturnType<typeof tsRestHandler> {
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
  getCustomCode(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getCustomCode, async () => {
      const data = await this.settingCoreService.getCustomCode();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateCustomCode)
  updateCustomCode(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateCustomCode, async ({ body }) => {
      const data = await this.settingCoreService.updateCustomCode(body);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getAboutInfo)
  getAboutInfo(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getAboutInfo, async () => {
      const data = await this.settingCoreService.getAboutInfo();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateAboutInfo)
  updateAboutInfo(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateAboutInfo, async ({ body }) => {
      const data = await this.settingCoreService.updateAboutInfo(body);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getSocials)
  getSocials(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getSocials, async () => {
      const data = await this.settingCoreService.getSocials();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateSocial)
  updateSocial(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateSocial, async ({ body }) => {
      const data = await this.settingCoreService.updateSocial({
        type: body.type ?? 'email',
        value: String(body.value ?? ''),
      });
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.deleteSocial)
  deleteSocial(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.deleteSocial, async ({ params }) => {
      const data = await this.settingCoreService.deleteSocial(params.type ?? 'email');
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getSocialTypes)
  getSocialTypes(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getSocialTypes, async () => {
      await Promise.resolve();
      const data = this.settingCoreService.getSocialTypes();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getWalineSetting)
  getWalineSetting(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getWalineSetting, async () => {
      const data = await this.settingCoreService.getWalineSetting();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateWalineSetting)
  updateWalineSetting(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateWalineSetting, async ({ body }) => {
      const data = await this.settingCoreService.updateWalineSetting(body);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getISRSetting)
  getISRSetting(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getISRSetting, async () => {
      const data = await this.settingCoreService.getISRSetting();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateISRSetting)
  updateISRSetting(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateISRSetting, async ({ body }) => {
      const data = await this.settingCoreService.updateISRSetting(body);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getLoginSetting)
  getLoginSetting(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getLoginSetting, async () => {
      const data = await this.settingCoreService.getLoginSetting();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateLoginSetting)
  updateLoginSetting(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateLoginSetting, async ({ body }) => {
      const data = await this.settingCoreService.updateLoginSetting(body);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getHttpsSetting)
  getHttpsSetting(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getHttpsSetting, async () => {
      const data = await this.settingCoreService.getHttpsSetting();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateHttpsSetting)
  updateHttpsSetting(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateHttpsSetting, async ({ body }) => {
      const data = await this.settingCoreService.updateHttpsSetting({
        redirect: body.redirect ?? false,
      });
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getStaticSetting)
  getStaticSetting(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getStaticSetting, async () => {
      const data = await this.settingCoreService.getStaticSetting();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateStaticSetting)
  updateStaticSetting(): ReturnType<typeof tsRestHandler> {
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
  getRewards(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getRewards, async () => {
      const data = await this.settingCoreService.getRewards();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.createReward)
  createReward(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.createReward, async ({ body }) => {
      const data = await this.settingCoreService.createReward({
        name: String(body.name ?? ''),
        value: String(body.value ?? ''),
      });
      return { status: 201, body: data };
    });
  }

  @TsRestHandler(contract.updateReward)
  updateReward(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateReward, async ({ params, body }) => {
      const data = await this.settingCoreService.updateReward(String(params.name ?? ''), {
        name: String(body.name ?? ''),
        value: String(body.value ?? ''),
      });
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.deleteReward)
  deleteReward(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.deleteReward, async ({ params }) => {
      const data = await this.settingCoreService.deleteReward(String(params.name ?? ''));
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getCaddyLog)
  getCaddyLog(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getCaddyLog, async () => {
      await Promise.resolve();
      const data = this.settingCoreService.getCaddyLog();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.clearCaddyLog)
  clearCaddyLog(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.clearCaddyLog, async () => {
      await Promise.resolve();
      this.settingCoreService.clearCaddyLog();
      return { status: 200, body: 'Logs cleared' };
    });
  }

  @TsRestHandler(contract.getCaddyConfig)
  getCaddyConfig(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getCaddyConfig, async () => {
      const data = await this.settingCoreService.getCaddyConfig();
      return { status: 200, body: JSON.stringify(data) };
    });
  }
}
