import { Test, type TestingModule } from '@nestjs/testing';
import { tokenBlacklist } from '@vanblog/shared/drizzle';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DATABASE_CONNECTION, type Database } from '../../database';

import { TokenBlacklistService } from './token-blacklist.service';

describe('TokenBlacklistService', () => {
  let service: TokenBlacklistService;
  let mockDb: Partial<Database>;

  beforeEach(async () => {
    mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenBlacklistService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<TokenBlacklistService>(TokenBlacklistService);
  });

  describe('revokeToken', () => {
    it('should revoke an access token', async () => {
      const token = 'test.access.token';
      const expiresAt = new Date(Date.now() + 3600000);

      const mockInsertBuilder = {
        values: vi.fn().mockResolvedValue(undefined),
      };
      mockDb.insert = vi.fn().mockReturnValue(mockInsertBuilder);

      await service.revokeToken(token, 'access', expiresAt, 1, 'User logout');

      expect(mockDb.insert).toHaveBeenCalledWith(tokenBlacklist);
      expect(mockInsertBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenType: 'access',
          userId: 1,
          reason: 'User logout',
        }),
      );
    });

    it('should revoke a refresh token', async () => {
      const token = 'test.refresh.token';
      const expiresAt = new Date(Date.now() + 86400000);

      const mockInsertBuilder = {
        values: vi.fn().mockResolvedValue(undefined),
      };
      mockDb.insert = vi.fn().mockReturnValue(mockInsertBuilder);

      await service.revokeToken(token, 'refresh', expiresAt, 2);

      expect(mockInsertBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenType: 'refresh',
          userId: 2,
        }),
      );
    });

    it('should handle token without userId', async () => {
      const token = 'anonymous.token';
      const expiresAt = new Date(Date.now() + 3600000);

      const mockInsertBuilder = {
        values: vi.fn().mockResolvedValue(undefined),
      };
      mockDb.insert = vi.fn().mockReturnValue(mockInsertBuilder);

      await service.revokeToken(token, 'access', expiresAt);

      expect(mockInsertBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenType: 'access',
          userId: undefined,
        }),
      );
    });

    it('should handle token without reason', async () => {
      const token = 'test.token';
      const expiresAt = new Date(Date.now() + 3600000);

      const mockInsertBuilder = {
        values: vi.fn().mockResolvedValue(undefined),
      };
      mockDb.insert = vi.fn().mockReturnValue(mockInsertBuilder);

      await service.revokeToken(token, 'access', expiresAt, 1);

      expect(mockInsertBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenType: 'access',
          userId: 1,
          reason: undefined,
        }),
      );
    });

    it('should throw error when database insert fails', async () => {
      mockDb.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      const token = 'test.token';
      const expiresAt = new Date(Date.now() + 3600000);

      await expect(service.revokeToken(token, 'access', expiresAt, 1)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('isTokenRevoked', () => {
    it('should return true when token is blacklisted', async () => {
      const token = 'blacklisted.token';

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      });

      const result = await service.isTokenRevoked(token);

      expect(result).toBe(true);
    });

    it('should return false when token is not blacklisted', async () => {
      const token = 'valid.token';

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.isTokenRevoked(token);

      expect(result).toBe(false);
    });

    it('should return true on database error (fail secure)', async () => {
      const token = 'error.token';

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      });

      const result = await service.isTokenRevoked(token);

      expect(result).toBe(true);
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all tokens for a user', async () => {
      const userId = 123;
      const reason = 'Password changed';

      const mockInsertBuilder = {
        values: vi.fn().mockResolvedValue(undefined),
      };
      mockDb.insert = vi.fn().mockReturnValue(mockInsertBuilder);

      const result = await service.revokeAllUserTokens(userId, reason);

      expect(result).toBe(1);
      expect(mockDb.insert).toHaveBeenCalledWith(tokenBlacklist);
      expect(mockInsertBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenHash: `user_${String(userId)}_all_tokens`,
          tokenType: 'access',
          userId,
          reason,
        }),
      );
    });

    it('should use default reason when not provided', async () => {
      const userId = 456;

      const mockInsertBuilder = {
        values: vi.fn().mockResolvedValue(undefined),
      };
      mockDb.insert = vi.fn().mockReturnValue(mockInsertBuilder);

      await service.revokeAllUserTokens(userId);

      expect(mockInsertBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'All user tokens revoked',
        }),
      );
    });

    it('should throw error when database insert fails', async () => {
      mockDb.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      await expect(service.revokeAllUserTokens(1)).rejects.toThrow('Database error');
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should clean up expired tokens', async () => {
      mockDb.delete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowsAffected: 5 }),
      });

      const result = await service.cleanupExpiredTokens();

      expect(result).toBe(5);
      expect(mockDb.delete).toHaveBeenCalledWith(tokenBlacklist);
    });

    it('should return 0 when no expired tokens found', async () => {
      mockDb.delete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
      });

      const result = await service.cleanupExpiredTokens();

      expect(result).toBe(0);
    });

    it('should throw error when database delete fails', async () => {
      mockDb.delete = vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      await expect(service.cleanupExpiredTokens()).rejects.toThrow('Database error');
    });
  });

  describe('getBlacklistStats', () => {
    it('should return blacklist statistics', async () => {
      const mockTotal = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const mockAccess = [{ id: 1 }, { id: 2 }];
      const mockRefresh = [{ id: 3 }];

      // Mock the three Promise.all queries
      let queryCount = 0;
      mockDb.select = vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => {
          queryCount++;
          if (queryCount === 1) {
            // First query: total
            return Promise.resolve(mockTotal);
          } else if (queryCount === 2) {
            // Second query: access
            return { where: vi.fn().mockResolvedValue(mockAccess) };
          } else {
            // Third query: refresh
            return { where: vi.fn().mockResolvedValue(mockRefresh) };
          }
        }),
      }));

      const stats = await service.getBlacklistStats();

      expect(stats).toEqual({
        totalEntries: 3,
        accessTokens: 2,
        refreshTokens: 1,
      });
    });

    it('should return zero stats on database error', async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      const stats = await service.getBlacklistStats();

      expect(stats).toEqual({
        totalEntries: 0,
        accessTokens: 0,
        refreshTokens: 0,
      });
    });

    it('should handle empty blacklist', async () => {
      let queryCount = 0;
      mockDb.select = vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => {
          queryCount++;
          if (queryCount === 1) {
            return Promise.resolve([]);
          } else {
            return { where: vi.fn().mockResolvedValue([]) };
          }
        }),
      }));

      const stats = await service.getBlacklistStats();

      expect(stats).toEqual({
        totalEntries: 0,
        accessTokens: 0,
        refreshTokens: 0,
      });
    });
  });
});
