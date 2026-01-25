import './setup.unit';

import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

import { CategoryService } from '../src/modules/category/category.service';
import { CommentService } from '../src/modules/comment/comment.service';
import { HookService } from '../src/modules/plugin/services/hook.service';
import { PluginDataValidator } from '../src/modules/plugin/services/plugin-data.validator';
import { PluginRegistryService } from '../src/modules/plugin/services/plugin-registry.service';
import { BootstrapService } from '../src/modules/public/bootstrap.service';
import { SettingCoreService } from '../src/modules/setting/services/setting-core.service';
import { TagService } from '../src/modules/tag/tag.service';
import { StatisticsService } from '../src/shared/services/statistics.service';

// Minimal mocks for dependencies used by BootstrapService
const mockConfigService = { get: vi.fn() };
const mockStatisticsService = {
  getOverallStatistics: vi.fn().mockResolvedValue({ publishedArticles: 1 }),
  getTotalPublishedWordCount: vi.fn().mockResolvedValue(100),
};
const mockSettingCoreService = {
  getSiteInfo: vi
    .fn()
    .mockResolvedValue({ title: 't', description: 'd', author: 'a', keywords: [] }),
  getNavigation: vi.fn().mockResolvedValue([]),
  getFriendLinks: vi.fn().mockResolvedValue([]),
};
const mockCommentService = {
  getResolvedWalineConfig: vi.fn().mockResolvedValue({ serverURL: 'http://x' }),
};
const mockTagService = { findAll: vi.fn().mockResolvedValue({ items: [] }) };
const mockCategoryService = { findAll: vi.fn().mockResolvedValue({ items: [] }) };
const mockHookService = {
  doAction: vi.fn().mockResolvedValue(undefined),
  applyFilters: vi.fn((_, resp) => resp),
};

const mockPluginRegistry = {
  getAllPublicData: vi.fn(),
};

describe('BootstrapService extensions aggregation', () => {
  let service: BootstrapService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        { provide: ConfigService, useValue: mockConfigService },
        { provide: StatisticsService, useValue: mockStatisticsService },
        { provide: SettingCoreService, useValue: mockSettingCoreService },
        { provide: CommentService, useValue: mockCommentService },
        { provide: TagService, useValue: mockTagService },
        { provide: CategoryService, useValue: mockCategoryService },
        { provide: HookService, useValue: mockHookService },
        { provide: PluginRegistryService, useValue: mockPluginRegistry },
        PluginDataValidator,
        BootstrapService,
      ],
    }).compile();

    service = moduleRef.get(BootstrapService);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('includes valid extension (with schema envelope)', async () => {
    const schema = z.object({ a: z.string() });
    mockPluginRegistry.getAllPublicData.mockResolvedValue({ p1: { schema, data: { a: 'ok' } } });
    const res = await service.getPublicBootstrap();
    expect(res.extensions).toEqual({ p1: { a: 'ok' } });
  });

  it('drops invalid extension (schema validation fails)', async () => {
    const schema = z.object({ a: z.string() });
    mockPluginRegistry.getAllPublicData.mockResolvedValue({ p1: { schema, data: { a: 1 } } });
    const res = await service.getPublicBootstrap();
    expect(res.extensions).toEqual({});
  });

  it('keeps plain serializable value and ignores non-serializable', async () => {
    const cyc: any = { x: 1 };
    cyc.self = cyc;
    mockPluginRegistry.getAllPublicData.mockResolvedValue({ p1: { k: 'v' }, p2: cyc });
    const res = await service.getPublicBootstrap();
    expect(res.extensions).toEqual({ p1: { k: 'v' } });
  });

  it('should not affect other fields', async () => {
    mockPluginRegistry.getAllPublicData.mockResolvedValue({});
    const res = await service.getPublicBootstrap();
    expect(res).toMatchObject({ version: expect.any(String), tags: [], totalArticles: 1 });
  });
});
