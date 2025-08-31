import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { PermissionService } from '../permission/permission.service';

import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';

import type { WalineSetting } from './comment.schema';

describe('CommentController', () => {
  let controller: CommentController;
  let commentService: CommentService;

  const mockWalineSetting: WalineSetting = {
    'smtp.enabled': true,
    'smtp.port': 587,
    'smtp.host': 'smtp.example.com',
    'smtp.user': 'user@example.com',
    'smtp.password': 'password',
    'sender.name': 'VanBlog',
    'sender.email': 'noreply@example.com',
    authorEmail: 'admin@example.com',
    webhook: 'https://example.com/webhook',
    forceLoginComment: false,
    otherConfig: '{"key":"value"}',
    serverURL: 'https://waline.example.com',
  };

  beforeEach(async () => {
    const mockCommentService = {
      getWalineSetting: vi.fn(),
      updateWalineSetting: vi.fn(),
      restart: vi.fn(),
      getStatus: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommentController],
      providers: [
        {
          provide: CommentService,
          useValue: mockCommentService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn().mockReturnValue(false) as any, // demoMode = false
          },
        },
        {
          provide: PermissionService,
          useValue: {
            hasPermission: vi.fn().mockReturnValue(true),
          },
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
      vi.mocked(commentService.getWalineSetting).mockResolvedValue(mockWalineSetting);

      const result = await controller.getWalineSetting();

      expect(result).toEqual(mockWalineSetting);
      expect(commentService.getWalineSetting).toHaveBeenCalled();
    });

    it('should return default setting if no setting found', async () => {
      const defaultSetting: WalineSetting = {
        'smtp.enabled': false,
        'smtp.port': 587,
        'smtp.host': '',
        'smtp.user': '',
        'smtp.password': '',
        'sender.name': '',
        'sender.email': 'noreply@example.com',
        authorEmail: 'admin@example.com',
        webhook: '',
        forceLoginComment: false,
        otherConfig: '',
        serverURL: '',
      };
      vi.mocked(commentService.getWalineSetting).mockResolvedValue(defaultSetting);

      const result = await controller.getWalineSetting();

      expect(result).toEqual(defaultSetting);
    });
  });

  describe('updateWalineSetting', () => {
    it('should update waline setting', async () => {
      const updateData = { 'smtp.enabled': false };
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
