import { UnauthorizedException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { AuthService } from '../auth.service';

import { LocalStrategy } from './local.strategy';

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  let mockValidateUser: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockValidateUser = vi.fn();
    const mockAuthService = {
      validateUser: mockValidateUser,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStrategy,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    strategy = module.get<LocalStrategy>(LocalStrategy);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return user when credentials are valid', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        type: 'AUTHOR' as const,
      };
      const username = 'testuser';
      const password = 'password123';

      mockValidateUser.mockResolvedValue(mockUser);

      const result = await strategy.validate(username, password);

      expect(mockValidateUser).toHaveBeenCalledWith(username, password);
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException when credentials are invalid', async () => {
      const username = 'testuser';
      const password = 'wrongpassword';

      mockValidateUser.mockResolvedValue(null);

      await expect(strategy.validate(username, password)).rejects.toThrow(UnauthorizedException);
      expect(mockValidateUser).toHaveBeenCalledWith(username, password);
    });

    it('should throw UnauthorizedException when authService throws error', async () => {
      const username = 'testuser';
      const password = 'password123';
      const error = new Error('Database connection failed');

      mockValidateUser.mockRejectedValue(error);

      await expect(strategy.validate(username, password)).rejects.toThrow(UnauthorizedException);
      expect(mockValidateUser).toHaveBeenCalledWith(username, password);
    });

    it('should handle empty username', async () => {
      const username = '';
      const password = 'password123';

      mockValidateUser.mockResolvedValue(null);

      await expect(strategy.validate(username, password)).rejects.toThrow(UnauthorizedException);
      expect(mockValidateUser).toHaveBeenCalledWith(username, password);
    });

    it('should handle empty password', async () => {
      const username = 'testuser';
      const password = '';

      mockValidateUser.mockResolvedValue(null);

      await expect(strategy.validate(username, password)).rejects.toThrow(UnauthorizedException);
      expect(mockValidateUser).toHaveBeenCalledWith(username, password);
    });
  });
});
