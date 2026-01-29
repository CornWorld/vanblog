import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { dayjs, contract } from '@vanblog/shared';
import { z } from 'zod';

import { DerivedView } from '../../shared/decorators/derived-view.decorator';
import { HookService } from '../plugin/services/hook.service';
import { SettingCoreService } from '../setting/services/setting-core.service';

type NavigationPublic = {
  name: string;
  path?: string;
  value?: string;
  icon?: string;
  external?: boolean;
  children?: NavigationPublic[];
};
const NavigationPublicSchema: z.ZodType<NavigationPublic> = z.lazy(() =>
  z.object({
    name: z.string(),
    path: z.string().optional(),
    value: z.string().optional(),
    icon: z.string().optional(),
    external: z.boolean().optional(),
    children: z.array(NavigationPublicSchema).optional(),
  }),
);

const BootstrapSchema = z.object({
  version: z.string(),
  tags: z.array(z.string()),
  totalArticles: z.number(),
  totalWordCount: z.number(),
  siteInfo: z.record(z.string(), z.unknown()),
  navigation: z.array(NavigationPublicSchema),
  friendLinks: z.array(
    z.object({
      name: z.string(),
      url: z.string(),
      description: z.string().optional(),
      avatar: z.string().optional(),
    }),
  ),
  categories: z.array(z.string()),
  extensions: z.record(z.string(), z.unknown()),
});
import { BootstrapService } from './bootstrap.service';

// 简化的 meta 结构，插件数据从 extensions 获取
const FriendLinkSchema = z.object({
  name: z.string(),
  desc: z.string().optional(),
  logo: z.string().optional(),
  url: z.string(),
  updatedAt: z.string().optional(),
});

const PublicMetaSchema = z.object({
  version: z.string(),
  tags: z.array(z.string()),
  totalArticles: z.number(),
  totalWordCount: z.number(),
  meta: z.object({
    links: z.array(FriendLinkSchema),
    categories: z.array(z.string()),
    about: z.object({ updatedAt: z.string(), content: z.string() }),
    siteInfo: z.record(z.string(), z.unknown()),
    extensions: z.record(z.string(), z.unknown()),
  }),
  menus: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      value: z.string().optional(),
      level: z.number(),
      children: z.never().optional(),
    }),
  ),
});

type PublicMetaProp = z.infer<typeof PublicMetaSchema>;

@ApiTags('Public')
@Controller({ path: 'public', version: '2' })
export class MetaController {
  constructor(
    private readonly bootstrapService: BootstrapService,
    private readonly hookService: HookService,
    private readonly settingCoreService: SettingCoreService,
  ) {}

  @TsRestHandler(contract.getPublicMeta)
  getPublicMeta(): unknown {
    return tsRestHandler(contract.getPublicMeta, async () => {
      await Promise.resolve();
      return { status: 200 as const, body: { buildTime: dayjs().format() } };
    });
  }

  @Get('meta')
  @Throttle({ short: { limit: 3, ttl: 1000 }, medium: { limit: 10, ttl: 10000 } })
  @ApiOperation({ summary: '获取公共元数据' })
  @ApiResponse({ status: 200, description: '公共元数据获取成功', type: Object })
  @DerivedView({ key: 'public-meta', ttl: 180, swr: true })
  async getMeta(): Promise<{ statusCode: number; data: PublicMetaProp }> {
    // 复用 bootstrap 数据
    const boot = BootstrapSchema.parse(await this.bootstrapService.getPublicBootstrap());

    // 获取关于信息
    const about = await this.settingCoreService.getAboutInfo();

    // 构造前端期望的 meta 结构
    const now = dayjs().format();

    const links = boot.friendLinks.map((f) => ({
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
    const walk = (nodes: NavigationPublic[] | undefined, level = 0): void => {
      if (!nodes) return;
      for (const n of nodes) {
        menus.push({ id: idCounter++, name: n.name, value: n.path ?? n.value ?? '', level });
        if (n.children && n.children.length > 0) {
          walk(n.children, level + 1);
        }
      }
    };
    walk(boot.navigation);

    const data = {
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

    const parsed = PublicMetaSchema.parse(data);

    // 插件过滤：允许扩展 meta 内容（保持键名一致）
    let filtered: PublicMetaProp;
    try {
      filtered = await this.hookService.applyFilters<PublicMetaProp>(
        'public|metaResponse',
        parsed,
        {
          action: 'public',
        },
      );
    } catch {
      filtered = parsed;
    }

    return { statusCode: 200, data: filtered };
  }
}
