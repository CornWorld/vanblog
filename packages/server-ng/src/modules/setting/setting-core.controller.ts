import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { initContract } from '@ts-rest/core';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { createSettingContract } from '@vanblog/shared/contracts';

import { Permission } from '../auth/permissions.decorator';

import { SettingCoreService, Navigation } from './services/setting-core.service';

const c = initContract();
const settingContract = createSettingContract(c);

@ApiTags('Settings')
@Controller({ path: 'admin/settings', version: '2' })
export class SettingCoreController {
  constructor(private readonly settingCoreService: SettingCoreService) {}

  @TsRestHandler(settingContract.getSiteInfo)
  @Permission('setting', ['read'])
  getSiteInfo_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.getSiteInfo, async () => {
      const data = await this.settingCoreService.getSiteInfo();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(settingContract.updateSiteInfo)
  @Permission('setting', ['update'])
  updateSiteInfo_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.updateSiteInfo, async ({ body }) => {
      // Contract uses title/description/author/keywords directly
      const data = await this.settingCoreService.updateSiteInfo(body);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(settingContract.getLayout)
  @Permission('setting', ['read'])
  getLayoutSettings_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.getLayout, async () => {
      const data = await this.settingCoreService.getLayoutSettings();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(settingContract.updateLayout)
  @Permission('setting', ['update'])
  updateLayoutSettings_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.updateLayout, async ({ body }) => {
      const data = await this.settingCoreService.updateLayoutSettings(body);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(settingContract.getTheme)
  @Permission('setting', ['read'])
  getThemeSettings_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.getTheme, async () => {
      const data = await this.settingCoreService.getThemeSettings();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(settingContract.updateTheme)
  @Permission('setting', ['update'])
  updateThemeSettings_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.updateTheme, async ({ body }) => {
      // Contract uses primaryColor/darkMode directly
      const data = await this.settingCoreService.updateThemeSettings(body);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(settingContract.getFriendLinks)
  @Permission('setting', ['read'])
  getFriendLinks_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.getFriendLinks, async () => {
      const data = await this.settingCoreService.getFriendLinks();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(settingContract.createFriendLink)
  @Permission('setting', ['update'])
  createFriendLink_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.createFriendLink, async ({ body }) => {
      // Contract fields match service interface
      const data = await this.settingCoreService.createFriendLink(body);
      return { status: 201, body: data };
    });
  }

  @TsRestHandler(settingContract.updateFriendLink)
  @Permission('setting', ['update'])
  updateFriendLink_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.updateFriendLink, async ({ params, body }) => {
      const { index } = params;
      const data = await this.settingCoreService.updateFriendLink(parseInt(index, 10), body);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(settingContract.deleteFriendLink)
  @Permission('setting', ['update'])
  deleteFriendLink_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.deleteFriendLink, async ({ params }) => {
      const { index } = params;
      const data = await this.settingCoreService.deleteFriendLink(parseInt(index, 10));
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(settingContract.getNavigation)
  @Permission('setting', ['read'])
  getNavigation_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.getNavigation, async () => {
      const data = await this.settingCoreService.getNavigation();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(settingContract.updateNavigation)
  @Permission('setting', ['update'])
  updateNavigation_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.updateNavigation, async ({ body }) => {
      // Map contract NavigationItem (path/external) to service Navigation (path/external)
      // The shared NavigationItem uses url/target, but contract uses path/external
      const mapItem = (item: {
        name: string;
        path: string;
        icon?: string;
        external?: boolean;
        children?: unknown[];
      }): Navigation => ({
        name: item.name,
        path: item.path,
        icon: item.icon,
        external: item.external ?? false,
        children: item.children?.map(mapItem),
      });

      const navigationItems = body.items.map(mapItem);
      const data = await this.settingCoreService.updateNavigation(navigationItems);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(settingContract.getCustomCode)
  @Permission('setting', ['read'])
  getCustomCode_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.getCustomCode, async () => {
      const data = await this.settingCoreService.getCustomCode();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(settingContract.updateCustomCode)
  @Permission('setting', ['update'])
  updateCustomCode_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.updateCustomCode, async ({ body }) => {
      const data = await this.settingCoreService.updateCustomCode(body);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(settingContract.getAbout)
  @Permission('setting', ['read'])
  getAboutInfo_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.getAbout, async () => {
      const data = await this.settingCoreService.getAboutInfo();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(settingContract.updateAbout)
  @Permission('setting', ['update'])
  updateAboutInfo_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.updateAbout, async ({ body }) => {
      const data = await this.settingCoreService.updateAboutInfo(body);
      return { status: 200, body: data };
    });
  }
}
