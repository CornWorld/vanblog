import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { Permission } from '../auth/permissions.decorator';

import {
  SettingCoreService,
  type AboutInfo,
  type CustomCode,
  type Navigation,
  type SiteInfo,
  type SiteLayout,
  type SiteTheme,
} from './services/setting-core.service';

import type { CreateFriendLink, FriendLink } from '@vanblog/shared';

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
  @Patch('site-info')
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
  @Patch('layout')
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
  @Patch('theme')
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
  @Patch('friend-links/:index')
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
  @Patch('navigation')
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
  @Patch('custom-code')
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
  @Patch('about')
  @ApiOperation({ summary: 'Update about page content' })
  @ApiResponse({ status: 200, description: 'About content updated' })
  async updateAbout(@Body() body: Partial<AboutInfo>): Promise<AboutInfo> {
    return this.settingCoreService.updateAboutInfo(body);
  }
}
