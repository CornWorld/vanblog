import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  SettingCoreService,
  SiteInfo,
  SiteLayout,
  SiteTheme,
  FriendLink,
  Navigation,
  CustomCode,
} from './services/setting-core.service';
import { UpdateSiteInfoDto, UpdateSiteInfoSchema } from './dto/update-site-info.dto';
import { UpdateLayoutDto, UpdateLayoutSchema } from './dto/update-layout.dto';
import { UpdateThemeDto, UpdateThemeSchema } from './dto/update-theme.dto';
import {
  CreateFriendLinkDto,
  UpdateFriendLinkDto,
  CreateFriendLinkSchema,
  UpdateFriendLinkSchema,
} from './dto/friend-link.dto';
import { UpdateNavigationDto, UpdateNavigationSchema } from './dto/navigation.dto';
import { UpdateCustomCodeDto, UpdateCustomCodeSchema } from './dto/custom-code.dto';
import { ZodValidationPipe } from 'nestjs-zod';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('settings')
@Controller('api/admin/settings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SettingCoreController {
  constructor(private readonly settingCoreService: SettingCoreService) {}

  @Get('site-info')
  @ApiOperation({ summary: 'Get site information' })
  async getSiteInfo(): Promise<SiteInfo> {
    return this.settingCoreService.getSiteInfo();
  }

  @Patch('site-info')
  @ApiOperation({ summary: 'Update site information' })
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
  @ApiOperation({ summary: 'Get layout settings' })
  async getLayoutSettings(): Promise<SiteLayout> {
    return this.settingCoreService.getLayoutSettings();
  }

  @Patch('layout')
  @ApiOperation({ summary: 'Update layout settings' })
  async updateLayoutSettings(
    @Body(new ZodValidationPipe(UpdateLayoutSchema)) updateLayoutDto: UpdateLayoutDto,
  ): Promise<SiteLayout> {
    return this.settingCoreService.updateLayoutSettings(updateLayoutDto);
  }

  @Get('theme')
  @ApiOperation({ summary: 'Get theme settings' })
  async getThemeSettings(): Promise<SiteTheme> {
    return this.settingCoreService.getThemeSettings();
  }

  @Patch('theme')
  @ApiOperation({ summary: 'Update theme settings' })
  async updateThemeSettings(
    @Body(new ZodValidationPipe(UpdateThemeSchema)) updateThemeDto: UpdateThemeDto,
  ): Promise<SiteTheme> {
    // Map DTO fields to SiteTheme interface
    const themeUpdate: Partial<SiteTheme> = {
      primaryColor: updateThemeDto.theme || '#000000',
      darkMode: false, // Default value, could be derived from config
    };
    return this.settingCoreService.updateThemeSettings(themeUpdate);
  }

  @Get('friend-links')
  @ApiOperation({ summary: 'Get friend links' })
  async getFriendLinks(): Promise<FriendLink[]> {
    return this.settingCoreService.getFriendLinks();
  }

  @Post('friend-links')
  @ApiOperation({ summary: 'Create a new friend link' })
  async createFriendLink(
    @Body(new ZodValidationPipe(CreateFriendLinkSchema)) createFriendLinkDto: CreateFriendLinkDto,
  ): Promise<FriendLink[]> {
    return this.settingCoreService.createFriendLink(createFriendLinkDto);
  }

  @Patch('friend-links/:index')
  @ApiOperation({ summary: 'Update a friend link by index' })
  async updateFriendLink(
    @Param('index', ParseIntPipe) index: number,
    @Body(new ZodValidationPipe(UpdateFriendLinkSchema)) updateFriendLinkDto: UpdateFriendLinkDto,
  ): Promise<FriendLink[]> {
    return this.settingCoreService.updateFriendLink(index, updateFriendLinkDto);
  }

  @Delete('friend-links/:index')
  @ApiOperation({ summary: 'Delete a friend link by index' })
  async deleteFriendLink(@Param('index', ParseIntPipe) index: number): Promise<FriendLink[]> {
    return this.settingCoreService.deleteFriendLink(index);
  }

  @Get('navigation')
  @ApiOperation({ summary: 'Get navigation items' })
  async getNavigation(): Promise<Navigation[]> {
    return this.settingCoreService.getNavigation();
  }

  @Patch('navigation')
  @ApiOperation({ summary: 'Update navigation items' })
  async updateNavigation(
    @Body(new ZodValidationPipe(UpdateNavigationSchema)) updateNavigationDto: UpdateNavigationDto,
  ): Promise<Navigation[]> {
    // Map NavigationItem to Navigation interface
    const navigationItems = updateNavigationDto.items.map((item) => ({
      name: item.name,
      path: item.url, // Map url to path
    }));
    return this.settingCoreService.updateNavigation(navigationItems);
  }

  @Get('custom-code')
  @ApiOperation({ summary: 'Get custom code injection settings' })
  async getCustomCode(): Promise<CustomCode> {
    return this.settingCoreService.getCustomCode();
  }

  @Patch('custom-code')
  @ApiOperation({ summary: 'Update custom code injection settings' })
  async updateCustomCode(
    @Body(new ZodValidationPipe(UpdateCustomCodeSchema)) updateCustomCodeDto: UpdateCustomCodeDto,
  ): Promise<CustomCode> {
    return this.settingCoreService.updateCustomCode(updateCustomCodeDto);
  }
}
