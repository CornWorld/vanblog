import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { Perm } from '../auth/permissions.decorator';

import { UpdateAboutSchema } from './dto/about.dto';
import { UpdateCustomCodeSchema } from './dto/custom-code.dto';
import { CreateFriendLinkSchema, UpdateFriendLinkSchema } from './dto/friend-link.dto';
import { UpdateNavigationSchema } from './dto/navigation.dto';
import { UpdateLayoutSchema } from './dto/update-layout.dto';
import { UpdateSiteInfoSchema } from './dto/update-site-info.dto';
import { UpdateThemeSchema } from './dto/update-theme.dto';
import {
  SettingCoreService,
  SiteInfo,
  SiteLayout,
  SiteTheme,
  Navigation,
  CustomCode,
  AboutInfo,
} from './services/setting-core.service';

import type { FriendLink } from '@vanblog/shared';

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
  async updateSiteInfo(@Body() rawBody: unknown): Promise<SiteInfo> {
    const parsed = UpdateSiteInfoSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestException({ message: 'Validation failed', issues: parsed.error.issues });
    }
    const updateSiteInfoDto = parsed.data;
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
  async updateLayoutSettings(@Body() rawBody: unknown): Promise<SiteLayout> {
    const parsed = UpdateLayoutSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestException({ message: 'Validation failed', issues: parsed.error.issues });
    }
    return this.settingCoreService.updateLayoutSettings(parsed.data);
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
  async updateThemeSettings(@Body() rawBody: unknown): Promise<SiteTheme> {
    const parsed = UpdateThemeSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestException({ message: 'Validation failed', issues: parsed.error.issues });
    }
    const updateThemeDto = parsed.data;
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
  async createFriendLink(@Body() rawBody: unknown): Promise<FriendLink> {
    const parsed = CreateFriendLinkSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestException({ message: 'Validation failed', issues: parsed.error.issues });
    }
    return this.settingCoreService.createFriendLink(parsed.data);
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
    @Body() rawBody: unknown,
  ): Promise<FriendLink> {
    const parsed = UpdateFriendLinkSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestException({ message: 'Validation failed', issues: parsed.error.issues });
    }
    return this.settingCoreService.updateFriendLink(index, parsed.data);
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
  async updateNavigation(@Body() rawBody: unknown): Promise<Navigation[]> {
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

    const parsedResult = UpdateNavigationSchema.safeParse(rawBody);
    if (!parsedResult.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: parsedResult.error.issues,
      });
    }
    const parsed: { items: NavItemLocal[] } = parsedResult.data;
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
  async updateCustomCode(@Body() rawBody: unknown): Promise<CustomCode> {
    const parsed = UpdateCustomCodeSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestException({ message: 'Validation failed', issues: parsed.error.issues });
    }
    return this.settingCoreService.updateCustomCode(parsed.data);
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
  async updateAboutInfo(@Body() rawBody: unknown): Promise<AboutInfo> {
    const parsed = UpdateAboutSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestException({ message: 'Validation failed', issues: parsed.error.issues });
    }
    return this.settingCoreService.updateAboutInfo(parsed.data);
  }
}
