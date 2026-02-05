import { Body, Controller, Get, Param, Post, Put, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { Permission } from '../auth/permissions.decorator';

import { SettingCoreService } from './services/setting-core.service';

@ApiTags('Settings')
@Controller()
export class SettingCoreController {
  constructor(private readonly settingCoreService: SettingCoreService) {}

  // Site Info
  @Permission('setting', ['read'])
  @Get('settings/site-info')
  @ApiOperation({ summary: 'Get site information' })
  async getSiteInfo() {
    return await this.settingCoreService.getSiteInfo();
  }

  @Permission('setting', ['update'])
  @Put('settings/site-info')
  @ApiOperation({ summary: 'Update site information' })
  async updateSiteInfo(@Body() body: unknown) {
    return await this.settingCoreService.updateSiteInfo(body);
  }

  // Layout
  @Permission('setting', ['read'])
  @Get('settings/layout')
  @ApiOperation({ summary: 'Get layout settings' })
  async getLayoutSettings() {
    return await this.settingCoreService.getLayoutSettings();
  }

  @Permission('setting', ['update'])
  @Put('settings/layout')
  @ApiOperation({ summary: 'Update layout settings' })
  async updateLayoutSettings(@Body() body: unknown) {
    return await this.settingCoreService.updateLayoutSettings(body);
  }

  // Theme
  @Permission('setting', ['read'])
  @Get('settings/theme')
  @ApiOperation({ summary: 'Get theme settings' })
  async getThemeSettings() {
    return await this.settingCoreService.getThemeSettings();
  }

  @Permission('setting', ['update'])
  @Put('settings/theme')
  @ApiOperation({ summary: 'Update theme settings' })
  async updateThemeSettings(@Body() body: unknown) {
    return await this.settingCoreService.updateThemeSettings(body);
  }

  // Friend Links
  @Permission('setting', ['read'])
  @Get('settings/friend-links')
  @ApiOperation({ summary: 'Get friend links' })
  async getFriendLinks() {
    return await this.settingCoreService.getFriendLinks();
  }

  @Permission('setting', ['update'])
  @Post('settings/friend-links')
  @ApiOperation({ summary: 'Create friend link' })
  async createFriendLink(@Body() body: unknown) {
    return await this.settingCoreService.createFriendLink(body);
  }

  @Permission('setting', ['update'])
  @Put('settings/friend-links/:index')
  @ApiOperation({ summary: 'Update friend link' })
  async updateFriendLink(@Param('index') index: string, @Body() body: unknown) {
    return await this.settingCoreService.updateFriendLink(Number(index), body);
  }

  @Permission('setting', ['update'])
  @Delete('settings/friend-links/:index')
  @ApiOperation({ summary: 'Delete friend link' })
  async deleteFriendLink(@Param('index') index: string) {
    return await this.settingCoreService.deleteFriendLink(Number(index));
  }

  // Navigation
  @Permission('setting', ['read'])
  @Get('settings/navigation')
  @ApiOperation({ summary: 'Get navigation menu' })
  async getNavigation() {
    return await this.settingCoreService.getNavigation();
  }

  @Permission('setting', ['update'])
  @Put('settings/navigation')
  @ApiOperation({ summary: 'Update navigation menu' })
  async updateNavigation(@Body() body: unknown) {
    return await this.settingCoreService.updateNavigation(body);
  }

  // Custom Code
  @Permission('setting', ['read'])
  @Get('settings/custom-code')
  @ApiOperation({ summary: 'Get custom code' })
  async getCustomCode() {
    return await this.settingCoreService.getCustomCode();
  }

  @Permission('setting', ['update'])
  @Put('settings/custom-code')
  @ApiOperation({ summary: 'Update custom code' })
  async updateCustomCode(@Body() body: unknown) {
    return await this.settingCoreService.updateCustomCode(body);
  }

  // About
  @Permission('setting', ['read'])
  @Get('settings/about')
  @ApiOperation({ summary: 'Get about information' })
  async getAboutInfo() {
    return await this.settingCoreService.getAboutInfo();
  }

  @Permission('setting', ['update'])
  @Put('settings/about')
  @ApiOperation({ summary: 'Update about information' })
  async updateAboutInfo(@Body() body: unknown) {
    return await this.settingCoreService.updateAboutInfo(body);
  }

  // Social
  @Permission('setting', ['read'])
  @Get('settings/social')
  @ApiOperation({ summary: 'Get social links' })
  async getSocials() {
    return await this.settingCoreService.getSocials();
  }

  @Permission('setting', ['update'])
  @Put('settings/social')
  @ApiOperation({ summary: 'Update social link' })
  async updateSocial(@Body() body: unknown) {
    return await this.settingCoreService.updateSocial(body);
  }

  @Permission('setting', ['update'])
  @Delete('settings/social/:type')
  @ApiOperation({ summary: 'Delete social link' })
  async deleteSocial(@Param('type') type: string) {
    return await this.settingCoreService.deleteSocial(type);
  }

  @Permission('setting', ['read'])
  @Get('settings/social/types')
  @ApiOperation({ summary: 'Get available social types' })
  async getSocialTypes() {
    return this.settingCoreService.getSocialTypes();
  }

  // Waline
  @Permission('setting', ['read'])
  @Get('settings/waline')
  @ApiOperation({ summary: 'Get Waline settings' })
  async getWalineSetting() {
    return await this.settingCoreService.getWalineSetting();
  }

  @Permission('setting', ['update'])
  @Put('settings/waline')
  @ApiOperation({ summary: 'Update Waline settings' })
  async updateWalineSetting(@Body() body: unknown) {
    return await this.settingCoreService.updateWalineSetting(body);
  }

  // ISR
  @Permission('setting', ['read'])
  @Get('settings/isr')
  @ApiOperation({ summary: 'Get ISR settings' })
  async getISRSetting() {
    return await this.settingCoreService.getISRSetting();
  }

  @Permission('setting', ['update'])
  @Put('settings/isr')
  @ApiOperation({ summary: 'Update ISR settings' })
  async updateISRSetting(@Body() body: unknown) {
    return await this.settingCoreService.updateISRSetting(body);
  }

  // Login
  @Permission('setting', ['read'])
  @Get('settings/login')
  @ApiOperation({ summary: 'Get login settings' })
  async getLoginSetting() {
    return await this.settingCoreService.getLoginSetting();
  }

  @Permission('setting', ['update'])
  @Put('settings/login')
  @ApiOperation({ summary: 'Update login settings' })
  async updateLoginSetting(@Body() body: unknown) {
    return await this.settingCoreService.updateLoginSetting(body);
  }

  // HTTPS
  @Permission('setting', ['read'])
  @Get('settings/https')
  @ApiOperation({ summary: 'Get HTTPS settings' })
  async getHttpsSetting() {
    return await this.settingCoreService.getHttpsSetting();
  }

  @Permission('setting', ['update'])
  @Put('settings/https')
  @ApiOperation({ summary: 'Update HTTPS settings' })
  async updateHttpsSetting(@Body() body: unknown) {
    return await this.settingCoreService.updateHttpsSetting(body);
  }

  // Static (Media)
  @Permission('setting', ['read'])
  @Get('settings/static')
  @ApiOperation({ summary: 'Get static settings' })
  async getStaticSetting() {
    return await this.settingCoreService.getStaticSetting();
  }

  @Permission('setting', ['update'])
  @Put('settings/static')
  @ApiOperation({ summary: 'Update static settings' })
  async updateStaticSetting(@Body() body: unknown) {
    return await this.settingCoreService.updateStaticSetting(body);
  }

  // Rewards (Donations)
  @Permission('setting', ['read'])
  @Get('settings/donations')
  @ApiOperation({ summary: 'Get donations' })
  async getRewards() {
    return await this.settingCoreService.getRewards();
  }

  @Permission('setting', ['update'])
  @Post('settings/donations')
  @ApiOperation({ summary: 'Create donation' })
  async createReward(@Body() body: unknown) {
    return await this.settingCoreService.createReward(body);
  }

  @Permission('setting', ['update'])
  @Put('settings/donations/:name')
  @ApiOperation({ summary: 'Update donation' })
  async updateReward(@Param('name') name: string, @Body() body: unknown) {
    return await this.settingCoreService.updateReward(name, body);
  }

  @Permission('setting', ['update'])
  @Delete('settings/donations/:name')
  @ApiOperation({ summary: 'Delete donation' })
  async deleteReward(@Param('name') name: string) {
    await this.settingCoreService.deleteReward(name);
    return { success: true };
  }
}
