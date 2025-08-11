import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { WalineSetting } from './comment.schema';

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
            get: vi.fn().mockReturnValue(false), // demoMode = false
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
      commentService.getWalineSetting.mockResolvedValue(mockWalineSetting);

      const result = await controller.getWalineSetting();

      expect(result).toEqual(mockWalineSetting);
      expect(commentService.getWalineSetting).toHaveBeenCalled();
    });

    it('should return null if no setting found', async () => {
      commentService.getWalineSetting.mockResolvedValue(null);

      const result = await controller.getWalineSetting();

      expect(result).toBeNull();
    });
  });

  describe('updateWalineSetting', () => {
    it('should update waline setting', async () => {
      const updateData = { 'smtp.enabled': false };
      const updatedSetting = { ...mockWalineSetting, ...updateData };

      commentService.updateWalineSetting.mockResolvedValue(updatedSetting);

      const result = await controller.updateWalineSetting(updateData);

      expect(result).toEqual(updatedSetting);
      expect(commentService.updateWalineSetting).toHaveBeenCalledWith(updateData);
    });
  });

  describe('restartWaline', () => {
    it('should restart waline service', async () => {
      commentService.restart.mockResolvedValue();

      const result = await controller.restartWaline();

      expect(result).toEqual({ message: 'Waline service restarted successfully' });
      expect(commentService.restart).toHaveBeenCalledWith('手动重启');
    });
  });

  describe('getWalineStatus', () => {
    it('should return waline service status', async () => {
      const mockStatus = { running: true, pid: 12345 };
      commentService.getStatus.mockReturnValue(mockStatus);

      const result = await controller.getWalineStatus();

      expect(result).toEqual(mockStatus);
      expect(commentService.getStatus).toHaveBeenCalled();
    });

    it('should return status when service is not running', async () => {
      const mockStatus = { running: false, pid: undefined };
      commentService.getStatus.mockReturnValue(mockStatus);

      const result = await controller.getWalineStatus();

      expect(result).toEqual(mockStatus);
    });
  });
});
