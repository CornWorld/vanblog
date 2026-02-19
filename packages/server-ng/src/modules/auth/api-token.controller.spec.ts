import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ApiTokenController } from './api-token.controller';
import { ApiTokenService } from './api-token.service';

const mockApiTokenService = {
  getAllTokens: vi.fn(),
  createToken: vi.fn(),
  deleteToken: vi.fn(),
};

describe('ApiTokenController', () => {
  let controller: ApiTokenController;
  let service: ApiTokenService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiTokenController],
      providers: [
        {
          provide: ApiTokenService,
          useValue: mockApiTokenService,
        },
      ],
    }).compile();

    controller = module.get<ApiTokenController>(ApiTokenController);
    service = module.get<ApiTokenService>(ApiTokenService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAllTokens', () => {
    it('should delegate to service and return all tokens', async () => {
      const mockTokens = [
        {
          _id: 'abc123',
          name: 'my-token',
          token: 'vanblog_xxx',
          createdAt: '2025-01-01T00:00:00Z',
        },
      ];
      mockApiTokenService.getAllTokens.mockResolvedValue(mockTokens);

      const result = await controller.getAllTokens();

      expect(result).toEqual(mockTokens);
      expect(service.getAllTokens).toHaveBeenCalledOnce();
    });
  });

  describe('createToken', () => {
    it('should pass name to service and return created token', async () => {
      const tokenName = 'ci-deploy';
      const mockCreated = {
        _id: 'def456',
        name: tokenName,
        token: 'vanblog_yyy',
        createdAt: '2025-06-01T12:00:00Z',
      };
      mockApiTokenService.createToken.mockResolvedValue(mockCreated);

      const result = await controller.createToken({ name: tokenName });

      expect(result).toEqual(mockCreated);
      expect(service.createToken).toHaveBeenCalledWith(tokenName);
    });
  });

  describe('deleteToken', () => {
    it('should return { success: true } when service returns true', async () => {
      mockApiTokenService.deleteToken.mockResolvedValue(true);

      const result = await controller.deleteToken('abc123');

      expect(result).toEqual({ success: true });
      expect(service.deleteToken).toHaveBeenCalledWith('abc123');
    });

    it('should return { success: false } when service returns false', async () => {
      mockApiTokenService.deleteToken.mockResolvedValue(false);

      const result = await controller.deleteToken('nonexistent');

      expect(result).toEqual({ success: false });
      expect(service.deleteToken).toHaveBeenCalledWith('nonexistent');
    });
  });
});
