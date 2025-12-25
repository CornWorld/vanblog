import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { HookService } from '../plugin/services/hook.service';
import { SettingCoreService } from '../setting/services/setting-core.service';
import { SettingRegistryService } from '../setting/services/setting-registry.service';
import { CommentModule } from './comment.module';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';

describe('CommentModule', () => {
  let module: TestingModule;

  const mockHookService = {
    doAction: vi.fn().mockResolvedValue(undefined),
    applyFilters: vi.fn((name, data) => Promise.resolve(data)),
  };

  const mockSettingCoreService = {
    getSiteMeta: vi.fn().mockResolvedValue({}),
  };

  const mockSettingRegistryService = {
    registerConfig: vi.fn(),
    getConfig: vi.fn().mockResolvedValue(null),
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [CommentModule],
    })
      .overrideProvider(HookService)
      .useValue(mockHookService)
      .overrideProvider(SettingCoreService)
      .useValue(mockSettingCoreService)
      .overrideProvider(SettingRegistryService)
      .useValue(mockSettingRegistryService)
      .compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide CommentController', () => {
    const controller = module.get<CommentController>(CommentController);
    expect(controller).toBeDefined();
  });

  it('should provide CommentService', () => {
    const service = module.get<CommentService>(CommentService);
    expect(service).toBeDefined();
  });

  it('should export CommentService', () => {
    const service = module.get<CommentService>(CommentService);
    expect(service).toBeDefined();
  });
});
