import { Controller, Get, Post, Body, Param, Patch, Delete, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';

import { Perm } from '../auth/permissions.decorator';

import { UpdateAboutDto, UpdateAboutSchema } from './dto/about.dto';
import { UpdateCustomCodeDto, UpdateCustomCodeSchema } from './dto/custom-code.dto';
import {
  CreateFriendLinkDto,
  UpdateFriendLinkDto,
  CreateFriendLinkSchema,
  UpdateFriendLinkSchema,
} from './dto/friend-link.dto';
import { UpdateNavigationDto, UpdateNavigationSchema } from './dto/navigation.dto';
import { UpdateLayoutDto, UpdateLayoutSchema } from './dto/update-layout.dto';
import { UpdateSiteInfoDto, UpdateSiteInfoSchema } from './dto/update-site-info.dto';
import { UpdateThemeDto, UpdateThemeSchema } from './dto/update-theme.dto';
import {
  SettingCoreService,
  SiteInfo,
  SiteLayout,
  SiteTheme,
  FriendLink,
  Navigation,
  CustomCode,
  AboutInfo,
} from './services/setting-core.service';

@ApiTags('Settings')
@Controller({ path: 'admin/settings', version: '2' })
export class SettingCoreController {
  constructor(private readonly settingCoreService: SettingCoreService) {}

  @Get('site-info')
  @Perm('setting', ['read'])
  @ApiOperation({ summary: 'Get site information' })
  @ApiResponse({
    status: 200,
    description: 'Site information retrieved successfully',
    type: Object,
  })
  async getSiteInfo(): Promise<SiteInfo> {
    return this.settingCoreService.getSiteInfo();
  }

  @Patch('site-info')
  @Perm('setting', ['update'])
  @ApiOperation({ summary: 'Update site information' })
  @ApiResponse({
    status: 200,
    description: 'Site information updated successfully',
    type: Object,
  })
  async updateSiteInfo(
    @Body(new ZodValidationPipe(UpdateSiteInfoSchema)) updateSiteInfoDto: UpdateSiteInfoDto,
  ): Promise<SiteInfo> {
    // Map DTO fields to SiteInfo interface
    const siteInfoUpdate: Partial<SiteInfo> = {
      title: updateSiteInfoDto.siteName,
      description: updateSiteInfoDto.siteDescription ?? '',
      author: updateSiteInfoDto.authorName ?? '',
      keywords: updateSiteInfoDto.siteKeywords
        ? updateSiteInfoDto.siteKeywords.split(',').map((k) => k.trim())
        : [],
    };
    return this.settingCoreService.updateSiteInfo(siteInfoUpdate);
  }

  @Get('layout')
  @Perm('setting', ['read'])
  @ApiOperation({ summary: 'Get layout settings' })
  @ApiResponse({
    status: 200,
    description: 'Layout settings retrieved successfully',
    type: Object,
  })
  async getLayoutSettings(): Promise<SiteLayout> {
    return this.settingCoreService.getLayoutSettings();
  }

  @Patch('layout')
  @Perm('setting', ['update'])
  @ApiOperation({ summary: 'Update layout settings' })
  @ApiResponse({
    status: 200,
    description: 'Layout settings updated successfully',
    type: Object,
  })
  async updateLayoutSettings(
    @Body(new ZodValidationPipe(UpdateLayoutSchema)) updateLayoutDto: UpdateLayoutDto,
  ): Promise<SiteLayout> {
    return this.settingCoreService.updateLayoutSettings(updateLayoutDto);
  }

  @Get('theme')
  @Perm('setting', ['read'])
  @ApiOperation({ summary: 'Get theme settings' })
  @ApiResponse({
    status: 200,
    description: 'Theme settings retrieved successfully',
    type: Object,
  })
  async getThemeSettings(): Promise<SiteTheme> {
    return this.settingCoreService.getThemeSettings();
  }

  @Patch('theme')
  @Perm('setting', ['update'])
  @ApiOperation({ summary: 'Update theme settings' })
  @ApiResponse({
    status: 200,
    description: 'Theme settings updated successfully',
    type: Object,
  })
  async updateThemeSettings(
    @Body(new ZodValidationPipe(UpdateThemeSchema)) updateThemeDto: UpdateThemeDto,
  ): Promise<SiteTheme> {
    // Map DTO fields to SiteTheme interface
    const themeUpdate: Partial<SiteTheme> = {
      primaryColor: updateThemeDto.theme !== '' ? updateThemeDto.theme : '#000000',
      darkMode: false, // Default value, could be derived from config
    };
    return this.settingCoreService.updateThemeSettings(themeUpdate);
  }

  @Get('friend-links')
  @Perm('setting', ['read'])
  @ApiOperation({ summary: 'Get friend links' })
  @ApiResponse({
    status: 200,
    description: 'Friend links retrieved successfully',
    type: [Object],
  })
  async getFriendLinks(): Promise<FriendLink[]> {
    return this.settingCoreService.getFriendLinks();
  }

  @Post('friend-links')
  @Perm('setting', ['update'])
  @ApiOperation({ summary: 'Create a new friend link' })
  @ApiResponse({
    status: 201,
    description: 'Friend link created successfully',
    type: [Object],
  })
  async createFriendLink(
    @Body(new ZodValidationPipe(CreateFriendLinkSchema)) createFriendLinkDto: CreateFriendLinkDto,
  ): Promise<FriendLink[]> {
    return this.settingCoreService.createFriendLink(createFriendLinkDto);
  }

  @Patch('friend-links/:index')
  @Perm('setting', ['update'])
  @ApiOperation({ summary: 'Update a friend link by index' })
  @ApiResponse({
    status: 200,
    description: 'Friend link updated successfully',
    type: [Object],
  })
  async updateFriendLink(
    @Param('index', ParseIntPipe) index: number,
    @Body(new ZodValidationPipe(UpdateFriendLinkSchema)) updateFriendLinkDto: UpdateFriendLinkDto,
  ): Promise<FriendLink[]> {
    return this.settingCoreService.updateFriendLink(index, updateFriendLinkDto);
  }

  @Delete('friend-links/:index')
  @Perm('setting', ['update'])
  @ApiOperation({ summary: 'Delete a friend link by index' })
  @ApiResponse({
    status: 200,
    description: 'Friend link deleted successfully',
    type: [Object],
  })
  async deleteFriendLink(@Param('index', ParseIntPipe) index: number): Promise<FriendLink[]> {
    return this.settingCoreService.deleteFriendLink(index);
  }

  @Get('navigation')
  @Perm('setting', ['read'])
  @ApiOperation({ summary: 'Get navigation items' })
  @ApiResponse({
    status: 200,
    description: 'Navigation items retrieved successfully',
    type: [Object],
  })
  async getNavigation(): Promise<Navigation[]> {
    return this.settingCoreService.getNavigation();
  }

  @Patch('navigation')
  @Perm('setting', ['update'])
  @ApiOperation({ summary: 'Update navigation items' })
  @ApiResponse({
    status: 200,
    description: 'Navigation items updated successfully',
    type: [Object],
  })
  async updateNavigation(
    @Body(new ZodValidationPipe(UpdateNavigationSchema)) updateNavigationDto: UpdateNavigationDto,
  ): Promise<Navigation[]> {
    // Map NavigationItem to Navigation interface (recursive)
    type NavItemLocal = {
      name: string;
      url: string;
      icon?: string;
      target: '_self' | '_blank';
      children?: NavItemLocal[];
    };
    const mapItem = (item: NavItemLocal): Navigation => ({
      name: item.name,
      path: item.url,
      icon: item.icon,
      external: item.target === '_blank',
      children: Array.isArray(item.children) ? item.children.map(mapItem) : undefined,
    });

    const parsed: { items: NavItemLocal[] } = UpdateNavigationSchema.parse(updateNavigationDto);
    const navigationItems = parsed.items.map((item: NavItemLocal) => mapItem(item));
    return this.settingCoreService.updateNavigation(navigationItems);
  }

  @Get('custom-code')
  @Perm('setting', ['read'])
  @ApiOperation({ summary: 'Get custom code injection settings' })
  @ApiResponse({
    status: 200,
    description: 'Custom code settings retrieved successfully',
    type: Object,
  })
  async getCustomCode(): Promise<CustomCode> {
    return this.settingCoreService.getCustomCode();
  }

  @Patch('custom-code')
  @Perm('setting', ['update'])
  @ApiOperation({ summary: 'Update custom code injection settings' })
  @ApiResponse({
    status: 200,
    description: 'Custom code settings updated successfully',
    type: Object,
  })
  async updateCustomCode(
    @Body(new ZodValidationPipe(UpdateCustomCodeSchema)) updateCustomCodeDto: UpdateCustomCodeDto,
  ): Promise<CustomCode> {
    return this.settingCoreService.updateCustomCode(updateCustomCodeDto);
  }

  // About Info
  @Get('about')
  @Perm('setting', ['read'])
  @ApiOperation({ summary: 'Get about page content' })
  @ApiResponse({ status: 200, description: 'About info retrieved successfully', type: Object })
  async getAboutInfo(): Promise<AboutInfo> {
    return this.settingCoreService.getAboutInfo();
  }

  @Patch('about')
  @Perm('setting', ['update'])
  @ApiOperation({ summary: 'Update about page content' })
  @ApiResponse({ status: 200, description: 'About info updated successfully', type: Object })
  async updateAboutInfo(
    @Body(new ZodValidationPipe(UpdateAboutSchema)) updateAboutDto: UpdateAboutDto,
  ): Promise<AboutInfo> {
    return this.settingCoreService.updateAboutInfo(updateAboutDto);
  }
}
