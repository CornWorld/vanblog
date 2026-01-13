import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { Mock } from '../../../test/mock';

import { PermissionService } from '../permission/permission.service';

import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';

describe('CommentController', () => {
  let controller: CommentController;
  let commentService: CommentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommentController],
      providers: [
        {
          provide: CommentService,
          useValue: Mock.commentService(),
        },
        {
          provide: ConfigService,
          useValue: Mock.config({ 'app.demoMode': false }),
        },
        {
          provide: PermissionService,
          useValue: Mock.permission(),
        },
      ],
    }).compile();

    controller = module.get<CommentController>(CommentController);
    commentService = module.get(CommentService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getWalineSetting', () => {
    it('should return waline setting', async () => {
      // ✅ 优化：使用新的扁平化 Mock API
      const mockWalineSetting = Mock.walineSetting() as any; // Type assertion for walineSetting mock
      vi.mocked(commentService.getWalineSetting).mockResolvedValue(mockWalineSetting);

      const result = await controller.getWalineSetting();

      expect(result).toEqual(mockWalineSetting);
      expect(commentService.getWalineSetting).toHaveBeenCalled();
    });

    it('should return default setting if no setting found', async () => {
      const defaultSetting = Mock.walineSetting({
        'smtp.enabled': false,
        'smtp.host': '',
        'smtp.user': '',
        'smtp.password': '',
        'sender.name': '',
        webhook: '',
        serverURL: '',
      } as Record<string, unknown>) as any; // Type assertion for walineSetting mock
      vi.mocked(commentService.getWalineSetting).mockResolvedValue(defaultSetting);

      const result = await controller.getWalineSetting();

      expect(result).toEqual(defaultSetting);
    });
  });

  describe('updateWalineSetting', () => {
    it('should update waline setting', async () => {
      // ✅ 优化：使用新的扁平化 Mock API
      const mockWalineSetting = Mock.walineSetting() as any; // Type assertion for walineSetting mock
      const updateData: Record<string, unknown> = { 'smtp.enabled': false };
      const updatedSetting = { ...mockWalineSetting, ...updateData };

      vi.mocked(commentService.updateWalineSetting).mockResolvedValue(updatedSetting);

      const result = await controller.updateWalineSetting(updateData);

      expect(result).toEqual(updatedSetting);
      expect(commentService.updateWalineSetting).toHaveBeenCalledWith(updateData);
    });
  });

  describe('restartWaline', () => {
    it('should restart waline service', async () => {
      vi.mocked(commentService.restart).mockResolvedValue();

      const result = await controller.restartWaline();
      expect(result).toEqual({
        message: 'Waline service restarted successfully',
      });
      expect(commentService.restart).toHaveBeenCalledWith('手动重启');
    });
  });

  describe('getWalineStatus', () => {
    it('should return waline service status', () => {
      const mockStatus = { running: true, pid: 12345 };
      vi.mocked(commentService.getStatus).mockReturnValue(mockStatus);

      const result = controller.getWalineStatus();

      expect(result).toEqual(mockStatus);
      expect(commentService.getStatus).toHaveBeenCalled();
    });

    it('should return status when service is not running', () => {
      const mockStatus = { running: false, pid: undefined };
      vi.mocked(commentService.getStatus).mockReturnValue(mockStatus);

      const result = controller.getWalineStatus();

      expect(result).toEqual(mockStatus);
    });
  });
});
