import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { AdminMetaController } from './meta.controller';
import { MetaService } from './meta.service';

const mockMetaService = {
  getVersionInfo: vi.fn(),
};

describe('AdminMetaController', () => {
  let controller: AdminMetaController;
  let metaService: MetaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminMetaController],
      providers: [
        {
          provide: MetaService,
          useValue: mockMetaService,
        },
      ],
    }).compile();

    controller = module.get<AdminMetaController>(AdminMetaController);
    metaService = module.get<MetaService>(MetaService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getVersionInfo', () => {
    it('should return version info', () => {
      const mockVersionInfo = {
        version: '1.0.0',
        latestVersion: '1.1.0',
        hasUpdate: true,
        updateInfo: {
          version: '1.1.0',
          description: 'New features',
          url: 'https://github.com/example/repo/releases/tag/v1.1.0',
        },
      };

      mockMetaService.getVersionInfo.mockReturnValue(mockVersionInfo);

      const result = controller.getVersionInfo();

      expect(result).toEqual({
        statusCode: 200,
        data: mockVersionInfo,
      });
      expect(metaService.getVersionInfo).toHaveBeenCalled();
    });

    it('should return version info without update info', () => {
      const mockVersionInfo = {
        version: '1.0.0',
        latestVersion: '1.0.0',
        hasUpdate: false,
      };

      mockMetaService.getVersionInfo.mockReturnValue(mockVersionInfo);

      const result = controller.getVersionInfo();

      expect(result).toEqual({
        statusCode: 200,
        data: mockVersionInfo,
      });
      expect(metaService.getVersionInfo).toHaveBeenCalled();
    });
  });
});
