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
  Put,
} from '@nestjs/common';
import { SettingService } from './services/setting.service';
import { UpdateSiteInfoDto } from './dto/update-site-info.dto';
import { UpdateLayoutDto } from './dto/update-layout.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';
import { CreateFriendLinkDto, UpdateFriendLinkDto } from './dto/friend-link.dto';
import { UpdateNavigationDto } from './dto/navigation.dto';
import { UpdateCustomCodeDto } from './dto/custom-code.dto';
import { UpdateBeianInfoDto } from './dto/beian-info.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  SiteInfo,
  SiteLayout,
  SiteTheme,
  FriendLink,
  Navigation,
  CustomCode,
  BeianInfo,
  AnalyticsConfig,
  DisplayConfig,
  PaymentInfo,
  AboutInfo,
  SocialLink,
  RewardInfo,
} from './entities/site-meta.entity';

@ApiTags('settings')
@Controller('api/admin/settings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SettingController {
  constructor(private readonly settingService: SettingService) {}

  @Get('site-info')
  @ApiOperation({ summary: 'Get site information' })
  async getSiteInfo(): Promise<SiteInfo> {
    return this.settingService.getSiteInfo();
  }

  @Patch('site-info')
  @ApiOperation({ summary: 'Update site information' })
  async updateSiteInfo(@Body() updateSiteInfoDto: UpdateSiteInfoDto): Promise<SiteInfo> {
    return this.settingService.updateSiteInfo(updateSiteInfoDto);
  }

  @Get('layout')
  @ApiOperation({ summary: 'Get layout settings' })
  async getLayoutSettings(): Promise<SiteLayout> {
    return this.settingService.getLayoutSettings();
  }

  @Patch('layout')
  @ApiOperation({ summary: 'Update layout settings' })
  async updateLayoutSettings(@Body() updateLayoutDto: UpdateLayoutDto): Promise<SiteLayout> {
    return this.settingService.updateLayoutSettings(updateLayoutDto);
  }

  @Get('theme')
  @ApiOperation({ summary: 'Get theme settings' })
  async getThemeSettings(): Promise<SiteTheme> {
    return this.settingService.getThemeSettings();
  }

  @Patch('theme')
  @ApiOperation({ summary: 'Update theme settings' })
  async updateThemeSettings(@Body() updateThemeDto: UpdateThemeDto): Promise<SiteTheme> {
    return this.settingService.updateThemeSettings(updateThemeDto);
  }

  @Get('friend-links')
  @ApiOperation({ summary: 'Get friend links' })
  async getFriendLinks(): Promise<FriendLink[]> {
    return this.settingService.getFriendLinks();
  }

  @Post('friend-links')
  @ApiOperation({ summary: 'Create a new friend link' })
  async createFriendLink(@Body() createFriendLinkDto: CreateFriendLinkDto): Promise<FriendLink[]> {
    return this.settingService.createFriendLink(createFriendLinkDto);
  }

  @Patch('friend-links/:index')
  @ApiOperation({ summary: 'Update a friend link by index' })
  async updateFriendLink(
    @Param('index', ParseIntPipe) index: number,
    @Body() updateFriendLinkDto: UpdateFriendLinkDto,
  ): Promise<FriendLink[]> {
    return this.settingService.updateFriendLink(index, updateFriendLinkDto);
  }

  @Delete('friend-links/:index')
  @ApiOperation({ summary: 'Delete a friend link by index' })
  async deleteFriendLink(@Param('index', ParseIntPipe) index: number): Promise<FriendLink[]> {
    return this.settingService.deleteFriendLink(index);
  }

  @Get('navigation')
  @ApiOperation({ summary: 'Get navigation items' })
  async getNavigation(): Promise<Navigation[]> {
    return this.settingService.getNavigation();
  }

  @Patch('navigation')
  @ApiOperation({ summary: 'Update navigation items' })
  async updateNavigation(@Body() updateNavigationDto: UpdateNavigationDto): Promise<Navigation[]> {
    return this.settingService.updateNavigation(updateNavigationDto);
  }

  @Get('custom-code')
  @ApiOperation({ summary: 'Get custom code injection settings' })
  async getCustomCode(): Promise<CustomCode> {
    return this.settingService.getCustomCode();
  }

  @Patch('custom-code')
  @ApiOperation({ summary: 'Update custom code injection settings' })
  async updateCustomCode(@Body() updateCustomCodeDto: UpdateCustomCodeDto): Promise<CustomCode> {
    return this.settingService.updateCustomCode(updateCustomCodeDto);
  }

  // 备案信息管理
  @Get('beian')
  @ApiOperation({ summary: 'Get beian information' })
  async getBeianInfo(): Promise<BeianInfo> {
    return this.settingService.getBeianInfo();
  }

  @Patch('beian')
  @ApiOperation({ summary: 'Update beian information' })
  async updateBeianInfo(@Body() dto: UpdateBeianInfoDto): Promise<BeianInfo> {
    return this.settingService.updateBeianInfo(dto);
  }

  // 分析配置管理
  @Get('analytics')
  @ApiOperation({ summary: 'Get analytics configuration' })
  async getAnalyticsConfig(): Promise<AnalyticsConfig> {
    return this.settingService.getAnalyticsConfig();
  }

  @Patch('analytics')
  @ApiOperation({ summary: 'Update analytics configuration' })
  async updateAnalyticsConfig(@Body() dto: Partial<AnalyticsConfig>): Promise<AnalyticsConfig> {
    return this.settingService.updateAnalyticsConfig(dto);
  }

  // 显示配置管理
  @Get('display')
  @ApiOperation({ summary: 'Get display configuration' })
  async getDisplayConfig(): Promise<DisplayConfig> {
    return this.settingService.getDisplayConfig();
  }

  @Patch('display')
  @ApiOperation({ summary: 'Update display configuration' })
  async updateDisplayConfig(@Body() dto: Partial<DisplayConfig>): Promise<DisplayConfig> {
    return this.settingService.updateDisplayConfig(dto);
  }

  // 支付信息管理
  @Get('payment')
  @ApiOperation({ summary: 'Get payment information' })
  async getPaymentInfo(): Promise<PaymentInfo> {
    return this.settingService.getPaymentInfo();
  }

  @Patch('payment')
  @ApiOperation({ summary: 'Update payment information' })
  async updatePaymentInfo(@Body() dto: Partial<PaymentInfo>): Promise<PaymentInfo> {
    return this.settingService.updatePaymentInfo(dto);
  }

  // 关于页面管理
  @Get('about')
  @ApiOperation({ summary: 'Get about page content' })
  async getAboutInfo(): Promise<AboutInfo> {
    return this.settingService.getAboutInfo();
  }

  @Put('about')
  @ApiOperation({ summary: 'Update about page content' })
  async updateAboutContent(@Body('content') content: string): Promise<AboutInfo> {
    return this.settingService.updateAboutContent(content);
  }

  // 社交链接管理
  @Get('social')
  @ApiOperation({ summary: 'Get social links' })
  async getSocialLinks(): Promise<SocialLink[]> {
    return this.settingService.getSocialLinks();
  }

  @Get('social/types')
  @ApiOperation({ summary: 'Get available social platform types' })
  getSocialTypes(): Array<{ label: string; value: string }> {
    return this.settingService.getSocialTypes();
  }

  @Put('social')
  @ApiOperation({ summary: 'Add or update a social link' })
  async addOrUpdateSocialLink(@Body() link: SocialLink): Promise<SocialLink[]> {
    return this.settingService.addOrUpdateSocialLink(link);
  }

  @Delete('social/:type')
  @ApiOperation({ summary: 'Delete a social link by type' })
  async deleteSocialLink(@Param('type') type: string): Promise<SocialLink[]> {
    return this.settingService.deleteSocialLink(type);
  }

  // 打赏信息管理
  @Get('reward')
  @ApiOperation({ summary: 'Get reward information' })
  async getRewardInfos(): Promise<RewardInfo[]> {
    return this.settingService.getRewardInfos();
  }

  @Put('reward')
  @ApiOperation({ summary: 'Add or update reward information' })
  async addOrUpdateRewardInfo(@Body() reward: RewardInfo): Promise<RewardInfo[]> {
    return this.settingService.addOrUpdateRewardInfo(reward);
  }

  @Delete('reward/:name')
  @ApiOperation({ summary: 'Delete reward information by name' })
  async deleteRewardInfo(@Param('name') name: string): Promise<RewardInfo[]> {
    return this.settingService.deleteRewardInfo(name);
  }
}
