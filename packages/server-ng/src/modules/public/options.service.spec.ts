import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, expect, vi } from 'vitest';

import { ArticleService } from '../article/article.service';
import { CategoryService } from '../category/category.service';
import { CommentService } from '../comment/comment.service';
import { HookService } from '../plugin/services/hook.service';
import { LoaderService } from '../plugin/services/loader.service';
import { SettingCoreService } from '../setting/services/setting-core.service';
import { TagService } from '../tag/tag.service';

import { OptionsService } from './options.service';

// Minimal plugin shape used by OptionsService
interface MockPlugin {
  name: string;
  getSocialLinks?: (ctx: unknown) => Promise<Array<{ type: string; url: string }>>;
}

const mockArticleService = { findAll: vi.fn() } as unknown as ArticleService;
const mockCategoryService = { findAll: vi.fn() } as unknown as CategoryService;
const mockTagService = { findAll: vi.fn() } as unknown as TagService;
const mockSettingCoreService = {
  getSiteInfo: vi.fn(),
  getNavigation: vi.fn(),
  getFriendLinks: vi.fn(),
} as unknown as SettingCoreService;
const mockCommentService = { getResolvedWalineConfig: vi.fn() } as unknown as CommentService;
const mockHookService = { applyFilters: vi.fn() } as unknown as HookService;

const mockLoaderService: Partial<LoaderService> = {
  getLoadedPlugins: vi.fn(),
  getPluginContext: vi.fn(),
};

describe('OptionsService (Public)', () => {
  let service: OptionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OptionsService,
        { provide: ArticleService, useValue: mockArticleService },
        { provide: CategoryService, useValue: mockCategoryService },
        { provide: TagService, useValue: mockTagService },
        { provide: SettingCoreService, useValue: mockSettingCoreService },
        { provide: CommentService, useValue: mockCommentService },
        { provide: HookService, useValue: mockHookService },
        { provide: LoaderService, useValue: mockLoaderService },
      ],
    }).compile();

    service = module.get<OptionsService>(OptionsService);

    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('getOptions should resolve socialLinks via plugin API when available', async () => {
    const plugin: MockPlugin = {
      name: 'Social Links Plugin',
      getSocialLinks: vi.fn().mockResolvedValue([
        { type: 'github', url: 'https://github.com/vanblog' },
        { type: 'twitter', url: 'https://twitter.com/vanblog' },
      ]),
    };

    // @ts-expect-error: mock shape for unit test
    mockLoaderService.getLoadedPlugins.mockReturnValue(
      new Map<string, MockPlugin>([['Social Links Plugin', plugin]]),
    );
    // @ts-expect-error: mock shape for unit test
    mockLoaderService.getPluginContext.mockReturnValue({});

    const result = await service.getOptions({ include: ['socialLinks'] } as any);

    expect(plugin.getSocialLinks).toHaveBeenCalledOnce();
    expect(result.socialLinks).toEqual([
      { name: 'github', url: 'https://github.com/vanblog' },
      { name: 'twitter', url: 'https://twitter.com/vanblog' },
    ]);
  });

  it('getOptions should fallback to empty array when plugin not found', async () => {
    // @ts-expect-error: mock shape for unit test
    mockLoaderService.getLoadedPlugins.mockReturnValue(new Map());

    const result = await service.getOptions({ include: ['socialLinks'] } as any);

    expect(result.socialLinks).toEqual([]);
  });
});
