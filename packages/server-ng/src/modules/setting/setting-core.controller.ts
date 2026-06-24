import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { Permission } from '../auth/permissions.decorator';

import {
  SettingCoreService,
  type AboutInfo,
  type CustomCode,
  type HttpsSetting,
  type ISRSetting,
  type LoginSetting,
  type Navigation,
  type SiteInfo,
  type SiteLayout,
  type SiteTheme,
  type SocialTypeInfo,
  type StaticSetting,
  type WalineSetting,
} from './services/setting-core.service';

import type {
  CreateFriendLink,
  FriendLink,
  RewardItem,
  SocialItem,
  SocialType,
} from '@vanblog/shared';

@ApiTags('Settings')
@Controller({ path: 'settings', version: '2' })
export class SettingCoreController {
  constructor(private readonly settingCoreService: SettingCoreService) {}

  // Site Info
  @Permission('setting', ['read'])
  @Get('site-info')
  @ApiOperation({ summary: 'Get site information' })
  @ApiResponse({ status: 200, description: 'Site info retrieved' })
  async getSiteInfo(): Promise<SiteInfo> {
    return this.settingCoreService.getSiteInfo();
  }

  @Permission('setting', ['update'])
  @Put('site-info')
  @ApiOperation({ summary: 'Update site information' })
  @ApiResponse({ status: 200, description: 'Site info updated' })
  async updateSiteInfo(@Body() body: Partial<SiteInfo>): Promise<SiteInfo> {
    return this.settingCoreService.updateSiteInfo(body);
  }

  // Layout
  @Permission('setting', ['read'])
  @Get('layout')
  @ApiOperation({ summary: 'Get layout settings' })
  @ApiResponse({ status: 200, description: 'Layout settings retrieved' })
  async getLayoutSettings(): Promise<SiteLayout> {
    return this.settingCoreService.getLayoutSettings();
  }

  @Permission('setting', ['update'])
  @Put('layout')
  @ApiOperation({ summary: 'Update layout settings' })
  @ApiResponse({ status: 200, description: 'Layout settings updated' })
  async updateLayoutSettings(@Body() body: Partial<SiteLayout>): Promise<SiteLayout> {
    return this.settingCoreService.updateLayoutSettings(body);
  }

  // Theme
  @Permission('setting', ['read'])
  @Get('theme')
  @ApiOperation({ summary: 'Get theme settings' })
  @ApiResponse({ status: 200, description: 'Theme settings retrieved' })
  async getThemeSettings(): Promise<SiteTheme> {
    return this.settingCoreService.getThemeSettings();
  }

  @Permission('setting', ['update'])
  @Put('theme')
  @ApiOperation({ summary: 'Update theme settings' })
  @ApiResponse({ status: 200, description: 'Theme settings updated' })
  async updateThemeSettings(@Body() body: Partial<SiteTheme>): Promise<SiteTheme> {
    return this.settingCoreService.updateThemeSettings(body);
  }

  // Friend Links
  @Permission('setting', ['read'])
  @Get('friend-links')
  @ApiOperation({ summary: 'Get friend links' })
  @ApiResponse({ status: 200, description: 'Friend links retrieved' })
  async getFriendLinks(): Promise<FriendLink[]> {
    return this.settingCoreService.getFriendLinks();
  }

  @Permission('setting', ['update'])
  @Post('friend-links')
  @ApiOperation({ summary: 'Create friend link' })
  @ApiResponse({ status: 201, description: 'Friend link created' })
  async createFriendLink(@Body() body: CreateFriendLink): Promise<FriendLink> {
    return this.settingCoreService.createFriendLink(body);
  }

  @Permission('setting', ['update'])
  @Put('friend-links/:index')
  @ApiOperation({ summary: 'Update friend link' })
  @ApiResponse({ status: 200, description: 'Friend link updated' })
  async updateFriendLink(
    @Param('index', ParseIntPipe) index: number,
    @Body() body: Partial<FriendLink>,
  ): Promise<FriendLink> {
    return this.settingCoreService.updateFriendLink(index, body);
  }

  @Permission('setting', ['update'])
  @Delete('friend-links/:index')
  @ApiOperation({ summary: 'Delete friend link' })
  @ApiResponse({ status: 200, description: 'Friend link deleted' })
  async deleteFriendLink(@Param('index', ParseIntPipe) index: number): Promise<FriendLink[]> {
    return this.settingCoreService.deleteFriendLink(index);
  }

  // Navigation
  @Permission('setting', ['read'])
  @Get('navigation')
  @ApiOperation({ summary: 'Get navigation menu' })
  @ApiResponse({ status: 200, description: 'Navigation menu retrieved' })
  async getNavigation(): Promise<Navigation[]> {
    return this.settingCoreService.getNavigation();
  }

  @Permission('setting', ['update'])
  @Put('navigation')
  @ApiOperation({ summary: 'Update navigation menu' })
  @ApiResponse({ status: 200, description: 'Navigation menu updated' })
  async updateNavigation(@Body() body: { items?: Navigation[] }): Promise<Navigation[]> {
    // Extract items from the body and map NavigationItem to Navigation
    const items = body.items ?? [];
    return this.settingCoreService.updateNavigation(items);
  }

  // Custom Code
  @Permission('setting', ['read'])
  @Get('custom-code')
  @ApiOperation({ summary: 'Get custom code settings' })
  @ApiResponse({ status: 200, description: 'Custom code settings retrieved' })
  async getCustomCode(): Promise<CustomCode> {
    return this.settingCoreService.getCustomCode();
  }

  @Permission('setting', ['update'])
  @Put('custom-code')
  @ApiOperation({ summary: 'Update custom code settings' })
  @ApiResponse({ status: 200, description: 'Custom code settings updated' })
  async updateCustomCode(@Body() body: Partial<CustomCode>): Promise<CustomCode> {
    return this.settingCoreService.updateCustomCode(body);
  }

  // About
  @Permission('setting', ['read'])
  @Get('about')
  @ApiOperation({ summary: 'Get about page content' })
  @ApiResponse({ status: 200, description: 'About content retrieved' })
  async getAbout(): Promise<AboutInfo> {
    return this.settingCoreService.getAboutInfo();
  }

  @Permission('setting', ['update'])
  @Put('about')
  @ApiOperation({ summary: 'Update about page content' })
  @ApiResponse({ status: 200, description: 'About content updated' })
  async updateAbout(@Body() body: Partial<AboutInfo>): Promise<AboutInfo> {
    return this.settingCoreService.updateAboutInfo(body);
  }

  // Social
  @Permission('setting', ['read'])
  @Get('social')
  @ApiOperation({ summary: 'Get social links' })
  @ApiResponse({ status: 200, description: 'Social links retrieved' })
  async getSocials(): Promise<SocialItem[]> {
    return this.settingCoreService.getSocials();
  }

  @Permission('setting', ['read'])
  @Get('social/types')
  @ApiOperation({ summary: 'Get available social types' })
  @ApiResponse({ status: 200, description: 'Social types retrieved' })
  getSocialTypes(): SocialTypeInfo[] {
    return this.settingCoreService.getSocialTypes();
  }

  @Permission('setting', ['update'])
  @Put('social')
  @ApiOperation({ summary: 'Update social link' })
  @ApiResponse({ status: 200, description: 'Social link updated' })
  async updateSocial(@Body() body: { type: SocialType; value: string }): Promise<SocialItem[]> {
    return this.settingCoreService.updateSocial(body);
  }

  @Permission('setting', ['update'])
  @Delete('social/:type')
  @ApiOperation({ summary: 'Delete social link' })
  @ApiResponse({ status: 200, description: 'Social link deleted' })
  async deleteSocial(@Param('type') type: SocialType): Promise<SocialItem[]> {
    return this.settingCoreService.deleteSocial(type);
  }

  // Waline
  @Permission('setting', ['read'])
  @Get('waline')
  @ApiOperation({ summary: 'Get Waline settings' })
  @ApiResponse({ status: 200, description: 'Waline settings retrieved' })
  async getWalineSetting(): Promise<WalineSetting> {
    return this.settingCoreService.getWalineSetting();
  }

  @Permission('setting', ['update'])
  @Put('waline')
  @ApiOperation({ summary: 'Update Waline settings' })
  @ApiResponse({ status: 200, description: 'Waline settings updated' })
  async updateWalineSetting(@Body() body: Partial<WalineSetting>): Promise<WalineSetting> {
    return this.settingCoreService.updateWalineSetting(body);
  }

  // ISR
  @Permission('setting', ['read'])
  @Get('isr')
  @ApiOperation({ summary: 'Get ISR settings' })
  @ApiResponse({ status: 200, description: 'ISR settings retrieved' })
  async getISRSetting(): Promise<ISRSetting> {
    return this.settingCoreService.getISRSetting();
  }

  @Permission('setting', ['update'])
  @Put('isr')
  @ApiOperation({ summary: 'Update ISR settings' })
  @ApiResponse({ status: 200, description: 'ISR settings updated' })
  async updateISRSetting(@Body() body: Partial<ISRSetting>): Promise<ISRSetting> {
    return this.settingCoreService.updateISRSetting(body);
  }

  // Login
  @Permission('setting', ['read'])
  @Get('login')
  @ApiOperation({ summary: 'Get login settings' })
  @ApiResponse({ status: 200, description: 'Login settings retrieved' })
  async getLoginSetting(): Promise<LoginSetting> {
    return this.settingCoreService.getLoginSetting();
  }

  @Permission('setting', ['update'])
  @Put('login')
  @ApiOperation({ summary: 'Update login settings' })
  @ApiResponse({ status: 200, description: 'Login settings updated' })
  async updateLoginSetting(@Body() body: Partial<LoginSetting>): Promise<LoginSetting> {
    return this.settingCoreService.updateLoginSetting(body);
  }

  // HTTPS
  @Permission('setting', ['read'])
  @Get('https')
  @ApiOperation({ summary: 'Get HTTPS settings' })
  @ApiResponse({ status: 200, description: 'HTTPS settings retrieved' })
  async getHttpsSetting(): Promise<HttpsSetting> {
    return this.settingCoreService.getHttpsSetting();
  }

  @Permission('setting', ['update'])
  @Put('https')
  @ApiOperation({ summary: 'Update HTTPS settings' })
  @ApiResponse({ status: 200, description: 'HTTPS settings updated' })
  async updateHttpsSetting(@Body() body: HttpsSetting): Promise<HttpsSetting> {
    return this.settingCoreService.updateHttpsSetting(body);
  }

  // Static
  @Permission('setting', ['read'])
  @Get('static')
  @ApiOperation({ summary: 'Get static storage settings' })
  @ApiResponse({ status: 200, description: 'Static settings retrieved' })
  async getStaticSetting(): Promise<StaticSetting> {
    return this.settingCoreService.getStaticSetting();
  }

  @Permission('setting', ['update'])
  @Put('static')
  @ApiOperation({ summary: 'Update static storage settings' })
  @ApiResponse({ status: 200, description: 'Static settings updated' })
  async updateStaticSetting(@Body() body: StaticSetting): Promise<StaticSetting> {
    return this.settingCoreService.updateStaticSetting(body);
  }

  // Donations / Rewards
  @Permission('setting', ['read'])
  @Get('donations')
  @ApiOperation({ summary: 'Get reward/donation settings' })
  @ApiResponse({ status: 200, description: 'Rewards retrieved' })
  async getRewards(): Promise<RewardItem[]> {
    return this.settingCoreService.getRewards();
  }

  @Permission('setting', ['update'])
  @Post('donations')
  @ApiOperation({ summary: 'Create reward/donation entry' })
  @ApiResponse({ status: 201, description: 'Reward created' })
  async createReward(@Body() body: { name: string; value: string }): Promise<RewardItem> {
    return this.settingCoreService.createReward(body);
  }

  @Permission('setting', ['update'])
  @Put('donations/:name')
  @ApiOperation({ summary: 'Update reward/donation entry' })
  @ApiResponse({ status: 200, description: 'Reward updated' })
  async updateReward(
    @Param('name') name: string,
    @Body() body: { name: string; value: string },
  ): Promise<RewardItem> {
    return this.settingCoreService.updateReward(name, body);
  }

  @Permission('setting', ['update'])
  @Delete('donations/:name')
  @ApiOperation({ summary: 'Delete reward/donation entry' })
  @ApiResponse({ status: 200, description: 'Reward deleted' })
  async deleteReward(@Param('name') name: string): Promise<boolean> {
    return this.settingCoreService.deleteReward(name);
  }
}
