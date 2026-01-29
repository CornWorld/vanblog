import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { BootstrapController } from './bootstrap.controller';
import { BootstrapService } from './bootstrap.service';

const mockBootstrapService = {
  getPublicBootstrap: vi.fn(),
  getVersionInfo: vi.fn(),
};

describe('BootstrapController (Public)', () => {
  let controller: BootstrapController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BootstrapController],
      providers: [{ provide: BootstrapService, useValue: mockBootstrapService }],
    }).compile();

    controller = module.get<BootstrapController>(BootstrapController);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getBootstrap should wrap service data into {statusCode,data}', async () => {
    const data = { version: 'x', tags: [], totalArticles: 0 } as any;
    mockBootstrapService.getPublicBootstrap.mockResolvedValue(data);

    const result = await controller.getBootstrap();

    expect(mockBootstrapService.getPublicBootstrap).toHaveBeenCalled();
    expect(result).toEqual({ statusCode: 200, data });
  });

  it('getVersionInfo should wrap service data into {statusCode,data}', () => {
    const data = { version: 'dev', latestVersion: 'v1.0.0', hasUpdate: false } as any;
    mockBootstrapService.getVersionInfo.mockReturnValue(data);

    const result = controller.getVersionInfo();

    expect(mockBootstrapService.getVersionInfo).toHaveBeenCalled();
    expect(result).toEqual({ statusCode: 200, data });
  });
});
