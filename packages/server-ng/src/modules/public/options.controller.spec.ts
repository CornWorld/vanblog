import { Test, type TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { OptionsController } from './options.controller';
import { OptionsService } from './options.service';

const mockOptionsService = {
  getOptions: vi.fn(),
};

describe('OptionsController (Public)', () => {
  let controller: OptionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OptionsController],
      providers: [{ provide: OptionsService, useValue: mockOptionsService }],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<OptionsController>(OptionsController);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getOptions should pass query and wrap result', async () => {
    const query = { include: ['articles', 'siteMeta'] } as any;
    const data = { articles: { items: [], total: 0 }, siteMeta: { title: 'x' } } as any;
    mockOptionsService.getOptions.mockResolvedValue(data);

    const result = await controller.getOptions(query);

    expect(mockOptionsService.getOptions).toHaveBeenCalledWith(query);
    expect(result).toEqual({ statusCode: 200, data });
  });
});
