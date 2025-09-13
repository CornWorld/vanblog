import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, expect, vi } from 'vitest';

import { ArticleService } from '../article/article.service';
import { CategoryService } from '../category/category.service';
import { CommentService } from '../comment/comment.service';
import { SettingCoreService } from '../setting/services/setting-core.service';
import { TagService } from '../tag/tag.service';

import { OptionsService } from './options.service';

const mockArticleService = { findAll: vi.fn() } as unknown as ArticleService;
const mockCategoryService = { findAll: vi.fn() } as unknown as CategoryService;
const mockTagService = { findAll: vi.fn() } as unknown as TagService;
const mockSettingCoreService = {
  getSiteInfo: vi.fn(),
  getNavigation: vi.fn(),
  getFriendLinks: vi.fn(),
} as unknown as SettingCoreService;
const mockCommentService = { getResolvedWalineConfig: vi.fn() } as unknown as CommentService;

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
      ],
    }).compile();

    service = module.get<OptionsService>(OptionsService);

    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // socialLinks and rewards have been removed from the system
  // Plugin data is now accessed through extensions field in bootstrap response
});
