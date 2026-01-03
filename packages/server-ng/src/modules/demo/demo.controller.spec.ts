import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { Mock } from '@test/mock';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';

describe('DemoController', () => {
  let controller: DemoController;
  let demoService: DemoService;

  beforeEach(async () => {
    const mockDemoService = Mock.demo();

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

      (demoService.isDemoModeEnabled as any).mockReturnValue(true);
      (demoService.getSnapshotInfo as any).mockReturnValue(mockSnapshotInfo);

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

      (demoService.isDemoModeEnabled as any).mockReturnValue(false);
      (demoService.getSnapshotInfo as any).mockReturnValue(mockSnapshotInfo);

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

      (demoService.manualRestore as any).mockResolvedValue(mockResult);

      const result = await controller.restoreDemo();

      expect(result).toEqual(mockResult);
      expect(demoService.manualRestore).toHaveBeenCalled();
    });

    it('should handle restore failure', async () => {
      const mockResult = {
        success: false,
        message: 'Demo mode is not enabled',
      };

      (demoService.manualRestore as any).mockResolvedValue(mockResult);

      const result = await controller.restoreDemo();

      expect(result).toEqual(mockResult);
    });
  });

  describe('createSnapshot', () => {
    it('should create snapshot successfully', async () => {
      (demoService.createSnapshot as any).mockResolvedValue(undefined);

      const result = await controller.createSnapshot();

      expect(result).toEqual({
        success: true,
        message: 'Demo snapshot created successfully',
      });
      expect(demoService.createSnapshot).toHaveBeenCalled();
    });

    it('should handle snapshot creation failure', async () => {
      const error = new Error('Database error');
      (demoService.createSnapshot as any).mockRejectedValue(error);

      const result = await controller.createSnapshot();

      expect(result).toEqual({
        success: false,
        message: 'Failed to create snapshot: Database error',
      });
    });
  });
});
