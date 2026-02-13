import { Controller, Get, Post, Patch, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@vanblog/shared';

import { Permission } from '../auth/permissions.decorator';

import { SettingCoreService } from './services/setting-core.service';

@ApiTags('Settings')
@Controller({ path: 'settings', version: '2' })
export class SettingCoreController {
  constructor(private readonly settingCoreService: SettingCoreService) {}

  // Site Info
  @TsRestHandler(contract.getSiteInfo)
  @Permission('setting', ['read'])
  @Get('site-info')
  @ApiOperation({ summary: 'Get site information' })
  @ApiResponse({ status: 200, description: 'Site info retrieved' })
  getSiteInfo_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getSiteInfo, async () => {
      const data = await this.settingCoreService.getSiteInfo();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateSiteInfo)
  @Permission('setting', ['update'])
  @Patch('site-info')
  @ApiOperation({ summary: 'Update site information' })
  @ApiResponse({ status: 200, description: 'Site info updated' })
  updateSiteInfo_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateSiteInfo, async ({ body }) => {
      const data = await this.settingCoreService.updateSiteInfo(body);
      return { status: 200, body: data };
    });
  }

  // Layout
  @TsRestHandler(contract.getLayoutSettings)
  @Permission('setting', ['read'])
  @Get('layout')
  @ApiOperation({ summary: 'Get layout settings' })
  @ApiResponse({ status: 200, description: 'Layout settings retrieved' })
  getLayoutSettings_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getLayoutSettings, async () => {
      const data = await this.settingCoreService.getLayoutSettings();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateLayoutSettings)
  @Permission('setting', ['update'])
  @Patch('layout')
  @ApiOperation({ summary: 'Update layout settings' })
  @ApiResponse({ status: 200, description: 'Layout settings updated' })
  updateLayoutSettings_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateLayoutSettings, async ({ body }) => {
      const data = await this.settingCoreService.updateLayoutSettings(body);
      return { status: 200, body: data };
    });
  }

  // Theme
  @TsRestHandler(contract.getThemeSettings)
  @Permission('setting', ['read'])
  @Get('theme')
  @ApiOperation({ summary: 'Get theme settings' })
  @ApiResponse({ status: 200, description: 'Theme settings retrieved' })
  getThemeSettings_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getThemeSettings, async () => {
      const data = await this.settingCoreService.getThemeSettings();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateThemeSettings)
  @Permission('setting', ['update'])
  @Patch('theme')
  @ApiOperation({ summary: 'Update theme settings' })
  @ApiResponse({ status: 200, description: 'Theme settings updated' })
  updateThemeSettings_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateThemeSettings, async ({ body }) => {
      const data = await this.settingCoreService.updateThemeSettings(body);
      return { status: 200, body: data };
    });
  }

  // Friend Links
  @TsRestHandler(contract.getFriendLinks)
  @Permission('setting', ['read'])
  @Get('friend-links')
  @ApiOperation({ summary: 'Get friend links' })
  @ApiResponse({ status: 200, description: 'Friend links retrieved' })
  getFriendLinks_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getFriendLinks, async () => {
      const data = await this.settingCoreService.getFriendLinks();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.createFriendLink)
  @Permission('setting', ['update'])
  @Post('friend-links')
  @ApiOperation({ summary: 'Create friend link' })
  @ApiResponse({ status: 201, description: 'Friend link created' })
  createFriendLink_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.createFriendLink, async ({ body }) => {
      const data = await this.settingCoreService.createFriendLink(body);
      return { status: 201, body: data };
    });
  }

  @TsRestHandler(contract.updateFriendLink)
  @Permission('setting', ['update'])
  @Patch('friend-links/:index')
  @ApiOperation({ summary: 'Update friend link' })
  @ApiResponse({ status: 200, description: 'Friend link updated' })
  updateFriendLink_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateFriendLink, async ({ params, body }) => {
      const data = await this.settingCoreService.updateFriendLink(params.index, body);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.deleteFriendLink)
  @Permission('setting', ['update'])
  @Delete('friend-links/:index')
  @ApiOperation({ summary: 'Delete friend link' })
  @ApiResponse({ status: 200, description: 'Friend link deleted' })
  deleteFriendLink_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.deleteFriendLink, async ({ params }) => {
      const data = await this.settingCoreService.deleteFriendLink(params.index);
      return { status: 200, body: data };
    });
  }

  // Navigation
  @TsRestHandler(contract.getNavigation)
  @Permission('setting', ['read'])
  @Get('navigation')
  @ApiOperation({ summary: 'Get navigation menu' })
  @ApiResponse({ status: 200, description: 'Navigation menu retrieved' })
  getNavigation_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getNavigation, async () => {
      const data = await this.settingCoreService.getNavigation();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateNavigation)
  @Permission('setting', ['update'])
  @Patch('navigation')
  @ApiOperation({ summary: 'Update navigation menu' })
  @ApiResponse({ status: 200, description: 'Navigation menu updated' })
  updateNavigation_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateNavigation, async ({ body }) => {
      // Extract items from the body and map NavigationItem to Navigation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items = (body as any).items || [];
      const data = await this.settingCoreService.updateNavigation(items);
      return { status: 200, body: data };
    });
  }

  // Custom Code
  @TsRestHandler(contract.getCustomCode)
  @Permission('setting', ['read'])
  @Get('custom-code')
  @ApiOperation({ summary: 'Get custom code settings' })
  @ApiResponse({ status: 200, description: 'Custom code settings retrieved' })
  getCustomCode_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getCustomCode, async () => {
      const data = await this.settingCoreService.getCustomCode();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateCustomCode)
  @Permission('setting', ['update'])
  @Patch('custom-code')
  @ApiOperation({ summary: 'Update custom code settings' })
  @ApiResponse({ status: 200, description: 'Custom code settings updated' })
  updateCustomCode_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateCustomCode, async ({ body }) => {
      const data = await this.settingCoreService.updateCustomCode(body);
      return { status: 200, body: data };
    });
  }

  // About
  @TsRestHandler(contract.getAboutInfo)
  @Permission('setting', ['read'])
  @Get('about')
  @ApiOperation({ summary: 'Get about page content' })
  @ApiResponse({ status: 200, description: 'About content retrieved' })
  getAbout_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getAboutInfo, async () => {
      const data = await this.settingCoreService.getAboutInfo();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateAboutInfo)
  @Permission('setting', ['update'])
  @Patch('about')
  @ApiOperation({ summary: 'Update about page content' })
  @ApiResponse({ status: 200, description: 'About content updated' })
  updateAbout_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateAboutInfo, async ({ body }) => {
      const data = await this.settingCoreService.updateAboutInfo(body);
      return { status: 200, body: data };
    });
  }
}
