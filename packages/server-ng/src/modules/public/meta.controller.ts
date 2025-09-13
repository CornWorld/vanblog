import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { DerivedView } from '../../shared/decorators/derived-view.decorator';
import { HookService } from '../plugin/services/hook.service';
import { SettingCoreService } from '../setting/services/setting-core.service';

import { BootstrapService } from './bootstrap.service';

import type { NavigationNode } from '../../shared/zod';

// 简化的 meta 结构，插件数据从 extensions 获取
interface FriendLinkDto {
  name: string;
  desc?: string;
  logo?: string;
  url: string;
  updatedAt?: string;
}

interface PublicMetaProp {
  version: string;
  tags: string[];
  totalArticles: number;
  totalWordCount: number;
  meta: {
    links: FriendLinkDto[];
    categories: string[];
    about: { updatedAt: string; content: string };
    siteInfo: Record<string, unknown>;
    // 插件数据通过 extensions 提供
    extensions: Record<string, unknown>;
  };
  menus: Array<{
    id: number;
    name: string;
    value: string;
    level: number;
    children?: never;
  }>;
}

@ApiTags('Public')
@Controller({ path: 'public', version: '2' })
export class MetaController {
  constructor(
    private readonly bootstrapService: BootstrapService,
    private readonly hookService: HookService,
    private readonly settingCoreService: SettingCoreService,
  ) {}

  @Get('meta')
  @Throttle({ short: { limit: 3, ttl: 1000 }, medium: { limit: 10, ttl: 10000 } })
  @ApiOperation({ summary: '获取公共元数据' })
  @ApiResponse({ status: 200, description: '公共元数据获取成功', type: Object })
  @DerivedView({ key: 'public-meta', ttl: 180, swr: true })
  async getMeta(): Promise<{ statusCode: number; data: PublicMetaProp }> {
    // 复用 bootstrap 数据
    const boot = await this.bootstrapService.getPublicBootstrap();

    // 获取关于信息
    const about = await this.settingCoreService.getAboutInfo();

    // 构造前端期望的 meta 结构
    const now = new Date().toISOString();

    const links: FriendLinkDto[] = boot.friendLinks.map((f) => ({
      name: f.name,
      desc: f.description,
      logo: f.avatar,
      url: f.url,
      updatedAt: now,
    }));

    const { categories } = boot;

    // 将 navigation 转换为 menus（扁平结构保留层级 id/level）
    const menus: Array<{
      id: number;
      name: string;
      value: string;
      level: number;
      children?: never;
    }> = [];
    let idCounter = 0;
    const walk = (nodes: NavigationNode[] | undefined, level = 0): void => {
      if (!nodes) return;
      for (const n of nodes) {
        menus.push({ id: idCounter++, name: n.name, value: n.path, level });
        if (n.children && n.children.length > 0) {
          walk(n.children, level + 1);
        }
      }
    };
    walk(boot.navigation as NavigationNode[]);

    const data: PublicMetaProp = {
      version: boot.version,
      tags: boot.tags,
      totalArticles: boot.totalArticles,
      totalWordCount: boot.totalWordCount,
      meta: {
        links,
        categories,
        about: { updatedAt: about.updatedAt, content: about.content },
        siteInfo: boot.siteInfo,
        extensions: boot.extensions, // 直接传递插件数据
      },
      menus,
    };

    // 插件过滤：允许扩展 meta 内容（保持键名一致）
    let filtered: PublicMetaProp;
    try {
      filtered = await this.hookService.applyFilters<PublicMetaProp>('public|metaResponse', data, {
        action: 'public',
      });
    } catch {
      filtered = data;
    }

    return { statusCode: 200, data: filtered };
  }
}
