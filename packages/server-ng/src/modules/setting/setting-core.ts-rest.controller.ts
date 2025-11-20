import { Controller } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract, NavigationItem } from '@vanblog/shared';
import { SettingCoreService, SiteInfo, SiteTheme, Navigation } from './services/setting-core.service';

@Controller()
export class SettingCoreTsRestController {
  constructor(private readonly settingCoreService: SettingCoreService) {}

  @TsRestHandler(contract.getSiteInfo)
  async getSiteInfo() {
    return tsRestHandler(contract.getSiteInfo, async () => {
      const data = await this.settingCoreService.getSiteInfo();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateSiteInfo)
  async updateSiteInfo() {
    return tsRestHandler(contract.updateSiteInfo, async ({ body }) => {
      const siteInfoUpdate: Partial<SiteInfo> = {
        title: body.siteName,
        description: body.siteDescription ?? '',
        author: body.authorName ?? '',
        keywords: body.siteKeywords
          ? body.siteKeywords.split(',').map((k) => k.trim())
          : [],
      };
      const data = await this.settingCoreService.updateSiteInfo(siteInfoUpdate);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getLayoutSettings)
  async getLayoutSettings() {
    return tsRestHandler(contract.getLayoutSettings, async () => {
      const data = await this.settingCoreService.getLayoutSettings();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateLayoutSettings)
  async updateLayoutSettings() {
    return tsRestHandler(contract.updateLayoutSettings, async ({ body }) => {
      const data = await this.settingCoreService.updateLayoutSettings(body);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getThemeSettings)
  async getThemeSettings() {
    return tsRestHandler(contract.getThemeSettings, async () => {
      const data = await this.settingCoreService.getThemeSettings();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateThemeSettings)
  async updateThemeSettings() {
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
  async getFriendLinks() {
    return tsRestHandler(contract.getFriendLinks, async () => {
      const data = await this.settingCoreService.getFriendLinks();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.createFriendLink)
  async createFriendLink() {
    return tsRestHandler(contract.createFriendLink, async ({ body }) => {
      const data = await this.settingCoreService.createFriendLink(body);
      return { status: 201, body: data };
    });
  }

  @TsRestHandler(contract.updateFriendLink)
  async updateFriendLink() {
    return tsRestHandler(contract.updateFriendLink, async ({ params, body }) => {
      const data = await this.settingCoreService.updateFriendLink(params.index, body);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.deleteFriendLink)
  async deleteFriendLink() {
    return tsRestHandler(contract.deleteFriendLink, async ({ params }) => {
      const data = await this.settingCoreService.deleteFriendLink(params.index);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getNavigation)
  async getNavigation() {
    return tsRestHandler(contract.getNavigation, async () => {
      const data = await this.settingCoreService.getNavigation();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateNavigation)
  async updateNavigation() {
    return tsRestHandler(contract.updateNavigation, async ({ body }) => {
      const mapItem = (item: NavigationItem): Navigation => ({
        name: item.name,
        path: item.url,
        icon: item.icon,
        external: item.target === '_blank',
        children: item.children?.map(mapItem),
      });

      const navigationItems = body.items.map(mapItem);
      const data = await this.settingCoreService.updateNavigation(navigationItems);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getCustomCode)
  async getCustomCode() {
    return tsRestHandler(contract.getCustomCode, async () => {
      const data = await this.settingCoreService.getCustomCode();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateCustomCode)
  async updateCustomCode() {
    return tsRestHandler(contract.updateCustomCode, async ({ body }) => {
      const data = await this.settingCoreService.updateCustomCode(body);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getAboutInfo)
  async getAboutInfo() {
    return tsRestHandler(contract.getAboutInfo, async () => {
      const data = await this.settingCoreService.getAboutInfo();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateAboutInfo)
  async updateAboutInfo() {
    return tsRestHandler(contract.updateAboutInfo, async ({ body }) => {
      const data = await this.settingCoreService.updateAboutInfo(body);
      return { status: 200, body: data };
    });
  }
}
