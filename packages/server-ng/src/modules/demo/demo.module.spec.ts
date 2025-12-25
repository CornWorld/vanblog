import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DATABASE_CONNECTION } from '../../database';
import { DemoModule } from './demo.module';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';

describe('DemoModule', () => {
  let module: TestingModule;

  const mockDatabase = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DemoModule],
    })
      .overrideProvider(DATABASE_CONNECTION)
      .useValue(mockDatabase)
      .compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide DemoController', () => {
    const controller = module.get<DemoController>(DemoController);
    expect(controller).toBeDefined();
  });

  it('should provide DemoService', () => {
    const service = module.get<DemoService>(DemoService);
    expect(service).toBeDefined();
  });

  it('should export DemoService', () => {
    const service = module.get<DemoService>(DemoService);
    expect(service).toBeDefined();
  });
});
