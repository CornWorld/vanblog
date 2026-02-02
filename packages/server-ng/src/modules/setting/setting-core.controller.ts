import { Controller, Get, Post, Put, Delete } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { initContract } from '@ts-rest/core';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@vanblog/shared';
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
  @Get()
  getSiteInfo_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.getSiteInfo, async () => {
      const data = await this.settingCoreService.getSiteInfo();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(settingContract.updateSiteInfo)
  @Permission('setting', ['update'])
  @Put()
  updateSiteInfo_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.updateSiteInfo, async ({ body }) => {
      // Contract uses title/description/author/keywords directly
      const data = await this.settingCoreService.updateSiteInfo(body);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(settingContract.getLayout)
  @Permission('setting', ['read'])
  @Get()
  getLayoutSettings_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.getLayout, async () => {
      const data = await this.settingCoreService.getLayoutSettings();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(settingContract.updateLayout)
  @Permission('setting', ['update'])
  @Put()
  updateLayoutSettings_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.updateLayout, async ({ body }) => {
      const data = await this.settingCoreService.updateLayoutSettings(body);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(settingContract.getTheme)
  @Permission('setting', ['read'])
  @Get()
  getThemeSettings_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.getTheme, async () => {
      const data = await this.settingCoreService.getThemeSettings();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(settingContract.updateTheme)
  @Permission('setting', ['update'])
  @Put()
  updateThemeSettings_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.updateTheme, async ({ body }) => {
      // Contract uses primaryColor/darkMode directly
      const data = await this.settingCoreService.updateThemeSettings(body);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(settingContract.getFriendLinks)
  @Permission('setting', ['read'])
  @Get()
  getFriendLinks_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.getFriendLinks, async () => {
      const data = await this.settingCoreService.getFriendLinks();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(settingContract.createFriendLink)
  @Permission('setting', ['update'])
  @Post()
  createFriendLink_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.createFriendLink, async ({ body }) => {
      // Contract fields match service interface
      const data = await this.settingCoreService.createFriendLink(body);
      return { status: 201, body: data };
    });
  }

  @TsRestHandler(settingContract.updateFriendLink)
  @Permission('setting', ['update'])
  @Put()
  updateFriendLink_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.updateFriendLink, async ({ params, body }) => {
      const { index } = params;
      const data = await this.settingCoreService.updateFriendLink(parseInt(index, 10), body);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(settingContract.deleteFriendLink)
  @Permission('setting', ['update'])
  @Delete()
  deleteFriendLink_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.deleteFriendLink, async ({ params }) => {
      const { index } = params;
      const data = await this.settingCoreService.deleteFriendLink(parseInt(index, 10));
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(settingContract.getNavigation)
  @Permission('setting', ['read'])
  @Get()
  getNavigation_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.getNavigation, async () => {
      const data = await this.settingCoreService.getNavigation();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(settingContract.updateNavigation)
  @Permission('setting', ['update'])
  @Put()
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
  @Get()
  getCustomCode_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.getCustomCode, async () => {
      const data = await this.settingCoreService.getCustomCode();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(settingContract.updateCustomCode)
  @Permission('setting', ['update'])
  @Put()
  updateCustomCode_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.updateCustomCode, async ({ body }) => {
      const data = await this.settingCoreService.updateCustomCode(body);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(settingContract.getAbout)
  @Permission('setting', ['read'])
  @Get()
  getAboutInfo_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.getAbout, async () => {
      const data = await this.settingCoreService.getAboutInfo();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(settingContract.updateAbout)
  @Permission('setting', ['update'])
  @Put()
  updateAboutInfo_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(settingContract.updateAbout, async ({ body }) => {
      const data = await this.settingCoreService.updateAboutInfo(body);
      return { status: 200, body: data };
    });
  }

  // Social Settings
  @TsRestHandler(contract.getSocials)
  @Permission('setting', ['read'])
  @Get()
  getSocials_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getSocials, async () => {
      const data = await this.settingCoreService.getSocials();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateSocial)
  @Permission('setting', ['update'])
  @Put()
  updateSocial_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateSocial, async ({ body }) => {
      const data = await this.settingCoreService.updateSocial(body);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.deleteSocial)
  @Permission('setting', ['update'])
  @Delete()
  deleteSocial_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.deleteSocial, async ({ params }) => {
      const { type } = params;
      const data = await this.settingCoreService.deleteSocial(type);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.getSocialTypes)
  @Permission('setting', ['read'])
  @Get()
  getSocialTypes_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getSocialTypes, () => {
      const data = this.settingCoreService.getSocialTypes();
      return { status: 200, body: data };
    });
  }

  // Waline Settings
  @TsRestHandler(contract.getWalineSetting)
  @Permission('setting', ['read'])
  @Get()
  getWalineSetting_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getWalineSetting, async () => {
      const data = await this.settingCoreService.getWalineSetting();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateWalineSetting)
  @Permission('setting', ['update'])
  @Put()
  updateWalineSetting_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateWalineSetting, async ({ body }) => {
      const data = await this.settingCoreService.updateWalineSetting(body);
      return { status: 200, body: data };
    });
  }

  // ISR Settings
  @TsRestHandler(contract.getISRSetting)
  @Permission('setting', ['read'])
  @Get()
  getISRSetting_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getISRSetting, async () => {
      const data = await this.settingCoreService.getISRSetting();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateISRSetting)
  @Permission('setting', ['update'])
  @Put()
  updateISRSetting_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateISRSetting, async ({ body }) => {
      const data = await this.settingCoreService.updateISRSetting(body);
      return { status: 200, body: data };
    });
  }

  // Login Settings
  @TsRestHandler(contract.getLoginSetting)
  @Permission('setting', ['read'])
  @Get()
  getLoginSetting_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getLoginSetting, async () => {
      const data = await this.settingCoreService.getLoginSetting();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateLoginSetting)
  @Permission('setting', ['update'])
  @Put()
  updateLoginSetting_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateLoginSetting, async ({ body }) => {
      const data = await this.settingCoreService.updateLoginSetting(body);
      return { status: 200, body: data };
    });
  }

  // HTTPS Settings
  @TsRestHandler(contract.getHttpsSetting)
  @Permission('setting', ['read'])
  @Get()
  getHttpsSetting_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getHttpsSetting, async () => {
      const data = await this.settingCoreService.getHttpsSetting();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateHttpsSetting)
  @Permission('setting', ['update'])
  @Put()
  updateHttpsSetting_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateHttpsSetting, async ({ body }) => {
      const data = await this.settingCoreService.updateHttpsSetting(body);
      return { status: 200, body: data };
    });
  }

  // Static (Media) Settings
  @TsRestHandler(contract.getStaticSetting)
  @Permission('setting', ['read'])
  @Get()
  getStaticSetting_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getStaticSetting, async () => {
      const data = await this.settingCoreService.getStaticSetting();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateStaticSetting)
  @Permission('setting', ['update'])
  @Put()
  updateStaticSetting_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateStaticSetting, async ({ body }) => {
      const data = await this.settingCoreService.updateStaticSetting(body);
      return { status: 200, body: data };
    });
  }

  // Rewards (Donations) Settings
  @TsRestHandler(contract.getRewards)
  @Permission('setting', ['read'])
  @Get()
  getRewards_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getRewards, async () => {
      const data = await this.settingCoreService.getRewards();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.createReward)
  @Permission('setting', ['update'])
  @Post()
  createReward_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.createReward, async ({ body }) => {
      const data = await this.settingCoreService.createReward(body);
      return { status: 201, body: data };
    });
  }

  @TsRestHandler(contract.updateReward)
  @Permission('setting', ['update'])
  @Put()
  updateReward_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateReward, async ({ params, body }) => {
      const { name } = params;
      const data = await this.settingCoreService.updateReward(name, body);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.deleteReward)
  @Permission('setting', ['update'])
  @Delete()
  deleteReward_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.deleteReward, async ({ params }) => {
      const { name } = params;
      await this.settingCoreService.deleteReward(name);
      return { status: 200, body: { success: true } };
    });
  }
}
