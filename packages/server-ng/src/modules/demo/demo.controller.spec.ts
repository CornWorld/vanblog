import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';

const mockDemoService = {
  isDemoModeEnabled: vi.fn(),
  getSnapshotInfo: vi.fn(),
  manualRestore: vi.fn(),
  createSnapshot: vi.fn(),
};

describe('DemoController', () => {
  let controller: DemoController;
  let demoService: DemoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DemoController],
      providers: [
        {
          provide: DemoService,
          useValue: mockDemoService,
        },
      ],
    }).compile();

    controller = module.get<DemoController>(DemoController);
    demoService = module.get<DemoService>(DemoService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStatus', () => {
    it('should return demo status with snapshot info', () => {
      const mockSnapshotInfo = {
        hasSnapshot: true,
        timestamp: 1754365478757,
        articlesCount: 5,
        draftsCount: 2,
      };

      mockDemoService.isDemoModeEnabled.mockReturnValue(true);
      mockDemoService.getSnapshotInfo.mockReturnValue(mockSnapshotInfo);

      const result = controller.getStatus();

      expect(result).toEqual({
        isDemoMode: true,
        ...mockSnapshotInfo,
      });
      expect(demoService.isDemoModeEnabled).toHaveBeenCalled();
      expect(demoService.getSnapshotInfo).toHaveBeenCalled();
    });

    it('should return demo status without snapshot', () => {
      const mockSnapshotInfo = {
        hasSnapshot: false,
      };

      mockDemoService.isDemoModeEnabled.mockReturnValue(false);
      mockDemoService.getSnapshotInfo.mockReturnValue(mockSnapshotInfo);

      const result = controller.getStatus();

      expect(result).toEqual({
        isDemoMode: false,
        hasSnapshot: false,
      });
    });
  });

  describe('restoreDemo', () => {
    it('should restore demo data successfully', async () => {
      const mockResult = {
        success: true,
        message: 'Demo data restored successfully',
      };

      mockDemoService.manualRestore.mockResolvedValue(mockResult);

      const result = await controller.restoreDemo();

      expect(result).toEqual(mockResult);
      expect(demoService.manualRestore).toHaveBeenCalled();
    });

    it('should handle restore failure', async () => {
      const mockResult = {
        success: false,
        message: 'Demo mode is not enabled',
      };

      mockDemoService.manualRestore.mockResolvedValue(mockResult);

      const result = await controller.restoreDemo();

      expect(result).toEqual(mockResult);
    });
  });

  describe('createSnapshot', () => {
    it('should create snapshot successfully', async () => {
      mockDemoService.createSnapshot.mockResolvedValue(undefined);

      const result = await controller.createSnapshot();

      expect(result).toEqual({
        success: true,
        message: 'Demo snapshot created successfully',
      });
      expect(demoService.createSnapshot).toHaveBeenCalled();
    });

    it('should handle snapshot creation failure', async () => {
      const error = new Error('Database error');
      mockDemoService.createSnapshot.mockRejectedValue(error);

      const result = await controller.createSnapshot();

      expect(result).toEqual({
        success: false,
        message: 'Failed to create snapshot: Database error',
      });
    });
  });
});
