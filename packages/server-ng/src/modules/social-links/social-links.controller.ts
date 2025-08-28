import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';

import { Perm } from '../auth/permissions.decorator';
import { LoaderService } from '../plugin/services/loader.service';

import {
  SocialLinksResponseDto,
  UpsertSocialLinkDto,
  UpsertSocialLinkSchema,
  type SocialLink,
} from './dto/social-link.dto';

import type { PluginContext } from '../plugin/interfaces/plugin-context.interface';

interface SocialLinksAPI {
  getSocialLinks: (ctx: PluginContext) => Promise<SocialLink[]>;
  addOrUpdateSocialLink: (ctx: PluginContext, data: SocialLink) => Promise<SocialLink[]>;
  deleteSocialLink: (ctx: PluginContext, type: string) => Promise<SocialLink[]>;
}

@ApiTags('Social Links')
@Controller({ path: 'admin/social-links', version: '2' })
export class SocialLinksController {
  constructor(private readonly loaderService: LoaderService) {}

  private getContextAndAPI(): { context?: PluginContext; api?: Partial<SocialLinksAPI> } {
    const plugins = this.loaderService.getLoadedPlugins();
    const plugin = plugins.get('Social Links Plugin');
    if (!plugin) return { context: undefined, api: undefined };
    const context = this.loaderService.getPluginContext(plugin.name);
    const api = plugin as unknown as Partial<SocialLinksAPI>;
    return { context, api };
  }

  @Get()
  @Perm('setting', ['read'])
  @ApiOperation({ summary: '获取所有社交媒体链接' })
  @ApiResponse({ status: 200, type: SocialLinksResponseDto })
  async list(): Promise<SocialLink[]> {
    const { context, api } = this.getContextAndAPI();
    if (!context || typeof api?.getSocialLinks !== 'function') return [];
    const links = await api.getSocialLinks(context);
    return links;
  }

  @Post()
  @HttpCode(200)
  @Perm('setting', ['update'])
  @ApiOperation({ summary: '新增或更新社交媒体链接（按 type 唯一）' })
  @ApiResponse({ status: 200, type: SocialLinksResponseDto })
  async upsert(
    @Body(new ZodValidationPipe(UpsertSocialLinkSchema)) dto: UpsertSocialLinkDto,
  ): Promise<SocialLink[]> {
    const { context, api } = this.getContextAndAPI();
    if (!context || typeof api?.addOrUpdateSocialLink !== 'function') return [];
    const links = await api.addOrUpdateSocialLink(context, dto as unknown as SocialLink);
    return links;
  }

  @Delete(':type')
  @Perm('setting', ['update'])
  @ApiOperation({ summary: '删除指定类型的社交媒体链接' })
  @ApiResponse({ status: 200, type: SocialLinksResponseDto })
  async delete(@Param('type') type: string): Promise<SocialLink[]> {
    const { context, api } = this.getContextAndAPI();
    if (!context || typeof api?.deleteSocialLink !== 'function') return [];
    const links = await api.deleteSocialLink(context, type);
    return links;
  }
}
