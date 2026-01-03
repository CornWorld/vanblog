import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach } from 'vitest';

import { Mock } from '@test/mock';

import { DATABASE_CONNECTION } from '../../database';
import { HookService } from '../plugin/services/hook.service';
import { SettingCoreService } from '../setting/services/setting-core.service';
import { SettingRegistryService } from '../setting/services/setting-registry.service';
import { CommentModule } from './comment.module';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';

describe('CommentModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [CommentModule],
    })
      .overrideProvider(DATABASE_CONNECTION)
      .useValue(Mock.db().build())
      .overrideProvider(HookService)
      .useValue(Mock.hook())
      .overrideProvider(SettingCoreService)
      .useValue(Mock.settingCore())
      .overrideProvider(SettingRegistryService)
      .useValue(Mock.settingRegistry())
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
