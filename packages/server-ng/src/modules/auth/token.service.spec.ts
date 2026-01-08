import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Mock } from '@test/mock';

import { UserType } from '../user/dto/create-user.dto';
import { UserService } from '../user/user.service';

import { TokenBlacklistService } from './token-blacklist.service';
import { TokenService } from './token.service';

// Mock bcrypt to avoid real hashing
vi.mock('bcrypt', () => ({
  hash: vi.fn().mockResolvedValue('hashed-password'),
  compare: vi.fn().mockResolvedValue(true),
}));

// Helper functions for random data generation
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomString = (length: number) =>
  Array.from({ length }, () => Math.random().toString(36)[2]).join('');
const randomUsername = () => `user_${randomString(8)}`;
const randomToken = (length = 32) => randomString(length);

describe('TokenService', () => {
  let service: TokenService;
  let mockJwtSign: ReturnType<typeof vi.fn>;
  let mockJwtVerify: ReturnType<typeof vi.fn>;
  let mockJwtDecode: ReturnType<typeof vi.fn>;
  let mockUserServiceFindOne: ReturnType<typeof vi.fn>;
  let mockConfigServiceGet: ReturnType<typeof vi.fn>;
  let mockTokenBlacklistService: {
    revokeToken: ReturnType<typeof vi.fn>;
    isTokenRevoked: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockJwtSign = vi.fn();
    mockJwtVerify = vi.fn();
    mockJwtDecode = vi.fn();
    mockUserServiceFindOne = vi.fn();
    mockConfigServiceGet = vi.fn((_: string, def: any) => def);
    mockTokenBlacklistService = {
      revokeToken: vi.fn(),
      isTokenRevoked: vi.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        {
          provide: JwtService,
          useValue: {
            sign: mockJwtSign,
            verify: mockJwtVerify,
            decode: mockJwtDecode,
          },
        },
        {
          provide: UserService,
          useValue: {
            findOne: mockUserServiceFindOne,
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: mockConfigServiceGet,
          },
        },
        {
          provide: TokenBlacklistService,
          useValue: mockTokenBlacklistService,
        },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateTokenPair', () => {
    it('should generate access and refresh tokens for user', () => {
      // Use faker for random data generation
      const user = Mock.user({
        id: randomInt(1, 10000),
        username: randomUsername(),
        type: UserType.AUTHOR,
      });

      const accessToken = randomToken();
      const refreshToken = randomToken();

      mockJwtSign.mockReturnValueOnce(accessToken).mockReturnValueOnce(refreshToken);

      const result = service.generateTokenPair(user as any);

      expect(result).toEqual({ accessToken, refreshToken });

      expect(mockJwtSign).toHaveBeenCalledTimes(2);
      expect(mockJwtSign).toHaveBeenNthCalledWith(
        1,
        {
          sub: user.id,
          username: user.username,
          type: user.type,
        },
        { expiresIn: '15m' },
      );
      expect(mockJwtSign).toHaveBeenNthCalledWith(
        2,
        {
          sub: user.id,
          username: user.username,
          type: user.type,
          tokenType: 'refresh',
        },
        { expiresIn: '7d' },
      );
    });
  });

  describe('generateAnonymousAccessToken', () => {
    it('should generate anonymous access token with default expires', () => {
      const anonymousToken = randomToken();
      mockJwtSign.mockReturnValue(anonymousToken);

      const result = service.generateAnonymousAccessToken();

      expect(result).toBe(anonymousToken);
      expect(mockJwtSign).toHaveBeenCalledWith(
        {
          sub: 'anonymous',
          username: 'anonymous',
          type: UserType.VIEWER,
          isAnonymous: true,
        },
        { expiresIn: '12h' },
      );
    });

    it('should support custom expires', () => {
      const token = randomToken();
      const customUsername = randomUsername();
      mockJwtSign.mockReturnValue(token);

      const result = service.generateAnonymousAccessToken(customUsername, '1h');

      expect(result).toBe(token);
      expect(mockJwtSign).toHaveBeenCalledWith(
        {
          sub: 'anonymous',
          username: customUsername,
          type: UserType.VIEWER,
          isAnonymous: true,
        },
        { expiresIn: '1h' },
      );
    });
  });

  describe('verifyAccessToken', () => {
    it('should return virtual user for anonymous payload', async () => {
      const token = randomToken();
      const anonUsername = randomUsername();
      mockJwtVerify.mockReturnValue({ sub: 'anonymous', username: anonUsername, isAnonymous: true });

      const result = await service.verifyAccessToken(token);

      expect(result).toMatchObject({ id: 0, username: anonUsername, type: UserType.VIEWER });
      expect(mockJwtVerify).toHaveBeenCalledWith(token);
    });

    it('should return real user for valid token', async () => {
      const user = Mock.user({
        id: randomInt(1, 10000),
        username: randomUsername(),
        type: UserType.AUTHOR,
      });
      const token = randomToken();
      mockJwtVerify.mockReturnValue({
        sub: user.id,
        username: user.username,
        type: user.type,
      });
      mockUserServiceFindOne.mockResolvedValue({ ...user });

      const result = await service.verifyAccessToken(token);

      expect(result).toEqual(user);
      expect(mockJwtVerify).toHaveBeenCalledWith(token);
      expect(mockUserServiceFindOne).toHaveBeenCalledWith(user.id);
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      const token = randomToken();
      mockJwtVerify.mockImplementation(() => {
        throw new Error('bad');
      });

      await expect(service.verifyAccessToken(token)).rejects.toThrow(UnauthorizedException);
      expect(mockJwtVerify).toHaveBeenCalledWith(token);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify refresh token and return user', async () => {
      const user = Mock.user({
        id: randomInt(1, 10000),
        username: randomUsername(),
        type: UserType.AUTHOR,
      });
      const accessToken = randomToken();
      const refreshToken = randomToken();

      mockJwtSign.mockReturnValueOnce(accessToken).mockReturnValueOnce(refreshToken);
      const generatedTokens = service.generateTokenPair(user as any);

      mockJwtVerify.mockReturnValue({
        sub: user.id,
        username: user.username,
        type: user.type,
        tokenType: 'refresh',
      });
      mockUserServiceFindOne.mockResolvedValue(user);

      const result = await service.verifyRefreshToken(generatedTokens.refreshToken);

      expect(result).toEqual(user);
      expect(mockJwtVerify).toHaveBeenCalledWith(generatedTokens.refreshToken);
      expect(mockUserServiceFindOne).toHaveBeenCalledWith(user.id);
    });

    it('should not call verify and throw for unknown refresh token', async () => {
      const token = randomToken();
      await expect(service.verifyRefreshToken(token)).rejects.toThrow(UnauthorizedException);
      expect(mockJwtVerify).not.toHaveBeenCalled();
    });

    it('should throw for wrong token type', async () => {
      const user = Mock.user({
        id: randomInt(1, 10000),
        username: randomUsername(),
        type: UserType.AUTHOR,
      });
      const accessToken = randomToken();
      const refreshToken = randomToken();

      mockJwtSign.mockReturnValueOnce(accessToken).mockReturnValueOnce(refreshToken);
      const generatedTokens = service.generateTokenPair(user as any);

      mockJwtVerify.mockReturnValue({
        sub: user.id,
        username: user.username,
        type: user.type,
        tokenType: 'access', // Wrong type - should be 'refresh'
      });

      await expect(service.verifyRefreshToken(generatedTokens.refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockJwtVerify).toHaveBeenCalledWith(generatedTokens.refreshToken);
    });

    it('should expire and reject expired refresh token', async () => {
      // Create a token but let it expire
      const accessToken = randomToken();
      mockJwtSign.mockReturnValueOnce(accessToken);

      // Create JWT with expiration in the past
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJ0eXBlIjoiYXV0aG9yIiwidG9rZW5UeXBlIjoicmVmcmVzaCIsImlhdCI6MTAwMDAwMDAwMDAwMDAwLCJleHAiOjEwMDAwMDAwMDAwMDAwfQ.fake';

      mockJwtVerify.mockImplementation(() => {
        const err = new Error('jwt expired');
        (err as any).name = 'TokenExpiredError';
        throw err;
      });

      await expect(service.verifyRefreshToken(expiredToken)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokenPair', () => {
    it('should refresh token pair successfully', async () => {
      const user = Mock.user({
        id: randomInt(1, 10000),
        username: randomUsername(),
        type: UserType.AUTHOR,
      });
      const oldAccessToken = randomToken();
      const oldRefreshToken = randomToken();

      // Generate initial token pair
      mockJwtSign.mockReturnValueOnce(oldAccessToken).mockReturnValueOnce(oldRefreshToken);
      const initialTokens = service.generateTokenPair(user as any);

      // Setup mocks for token refresh (don't clear to preserve token state)
      const newAccessToken = randomToken();
      const newRefreshToken = randomToken();

      mockJwtVerify.mockReturnValue({
        sub: user.id,
        username: user.username,
        type: user.type,
        tokenType: 'refresh',
      });
      mockUserServiceFindOne.mockResolvedValue(user);
      mockJwtSign.mockReturnValueOnce(newAccessToken).mockReturnValueOnce(newRefreshToken);

      const result = await service.refreshTokenPair(initialTokens.refreshToken);

      // Verify new token pair is returned
      expect(result).toEqual({ accessToken: newAccessToken, refreshToken: newRefreshToken });
      expect(mockJwtVerify).toHaveBeenCalledWith(initialTokens.refreshToken);
      expect(mockUserServiceFindOne).toHaveBeenCalledWith(user.id);

      // Verify the old refresh token was revoked (critical assertion)
      expect(service.isTokenRevoked(initialTokens.refreshToken)).toBe(true);
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      const invalidToken = randomToken();
      await expect(service.refreshTokenPair(invalidToken)).rejects.toThrow(UnauthorizedException);
      expect(mockJwtVerify).not.toHaveBeenCalled();
    });
  });

  describe('revokeToken', () => {
    it('should add token to revoked tokens set', async () => {
      const token = randomToken();
      await service.revokeToken(token);
      expect(service.isTokenRevoked(token)).toBe(true);
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all user tokens of the given user', () => {
      const userId1 = randomInt(1000, 2000);
      const userId2 = randomInt(2001, 3000);
      const user1 = Mock.user({ id: userId1 });
      const user2 = Mock.user({ id: userId2 });

      // Mock JWT sign for consistent token generation
      let signCallCount = 0;
      mockJwtSign.mockImplementation(() => {
        return randomToken() + String(signCallCount++);
      });

      // Generate tokens for user 1
      const t1 = service.generateTokenPair(user1 as any).refreshToken;
      const t2 = service.generateTokenPair(user1 as any).refreshToken;
      // Generate token for user 2
      const t3 = service.generateTokenPair(user2 as any).refreshToken;

      // Verify tokens are not revoked before
      expect(service.isTokenRevoked(t1)).toBe(false);
      expect(service.isTokenRevoked(t2)).toBe(false);
      expect(service.isTokenRevoked(t3)).toBe(false);

      // Revoke all tokens for user 1
      service.revokeAllUserTokens(userId1);

      // Verify user 1 tokens are revoked
      expect(service.isTokenRevoked(t1)).toBe(true);
      expect(service.isTokenRevoked(t2)).toBe(true);
      // User 2 token should not be revoked
      expect(service.isTokenRevoked(t3)).toBe(false);
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should clean up expired tokens from in-memory store', async () => {
      const user = Mock.user({
        id: randomInt(1, 10000),
        username: randomUsername(),
      });

      // Generate token pair (creates active refresh token)
      const accessToken = randomToken();
      const refreshToken = randomToken();
      mockJwtSign.mockReturnValueOnce(accessToken).mockReturnValueOnce(refreshToken);
      const tokens = service.generateTokenPair(user as any);

      // Mock JWT verify to simulate expired token
      mockJwtVerify.mockImplementation(() => {
        const err = new Error('jwt expired');
        (err as any).name = 'TokenExpiredError';
        throw err;
      });

      // Cleanup should remove expired tokens
      service.cleanupExpiredTokens();

      // Try to verify the generated token - should fail if cleanup worked
      await expect(service.verifyRefreshToken(tokens.refreshToken)).rejects.toThrow();
    });
  });

  describe('getUserActiveTokenCount', () => {
    it('should return active token count for user', () => {
      const userId = randomInt(1, 10000);
      const user = Mock.user({ id: userId });

      // Generate multiple tokens for same user
      mockJwtSign
        .mockReturnValueOnce(randomToken())
        .mockReturnValueOnce(randomToken())
        .mockReturnValueOnce(randomToken())
        .mockReturnValueOnce(randomToken());

      service.generateTokenPair(user as any);
      service.generateTokenPair(user as any);

      // Both tokens should be active
      const count = service.getUserActiveTokenCount(userId);
      expect(count).toBe(2);
    });
  });

  describe('isTokenRevoked', () => {
    it('should return false for non-revoked token', () => {
      expect(service.isTokenRevoked(randomToken())).toBe(false);
    });

    it('should return true for revoked token', async () => {
      const token = randomToken();
      await service.revokeToken(token);
      expect(service.isTokenRevoked(token)).toBe(true);
    });
  });

  describe('revokeAllTokens', () => {
    it('should revoke all tokens in the system', () => {
      const t1 = randomToken();
      const t2 = randomToken();
      const t3 = randomToken();
      // Accessing private field for testing purposes - testing internal state management
      (service as any).refreshTokens.set(t1, {
        token: t1,
        expiresAt: dayjs().add(1, 'day'),
        userId: 1,
        type: 'refresh',
      });
      (service as any).refreshTokens.set(t2, {
        token: t2,
        expiresAt: dayjs().add(1, 'day'),
        userId: 2,
        type: 'refresh',
      });
      (service as any).refreshTokens.set(t3, {
        token: t3,
        expiresAt: dayjs().add(1, 'day'),
        userId: 3,
        type: 'refresh',
      });

      service.revokeAllTokens();

      expect(service.isTokenRevoked(t1)).toBe(true);
      expect(service.isTokenRevoked(t2)).toBe(true);
      expect(service.isTokenRevoked(t3)).toBe(true);
      expect((service as any).refreshTokens.size).toBe(0);
    });
  });

  describe('getTokenStats', () => {
    it('should return correct token statistics', () => {
      const t1 = randomToken();
      const t2 = randomToken();
      const t3 = randomToken();
      // Accessing private field for testing purposes - testing statistics calculation
      (service as any).refreshTokens.set(t1, {
        token: t1,
        expiresAt: dayjs().add(1, 'day'),
        userId: 1,
        type: 'refresh',
      });
      (service as any).refreshTokens.set(t2, {
        token: t2,
        expiresAt: dayjs().add(1, 'day'),
        userId: 2,
        type: 'refresh',
      });
      (service as any).refreshTokens.set(t3, {
        token: t3,
        expiresAt: dayjs().add(1, 'day'),
        userId: 1,
        type: 'refresh',
      });

      const stats = service.getTokenStats();

      expect(stats.activeRefreshTokens).toBe(3);
      expect(stats.revokedTokens).toBe(0);
      expect(stats.totalUsers).toBe(2); // userId 1 and 2
    });

    it('should count revoked tokens correctly', async () => {
      await service.revokeToken(randomToken());
      await service.revokeToken(randomToken());

      const stats = service.getTokenStats();

      expect(stats.revokedTokens).toBe(2);
    });
  });

  describe('generateTokenPair - custom expirations', () => {
    it('should use custom JWT_EXPIRES_IN from config', () => {
      mockConfigServiceGet.mockImplementation((key: string, def: any) => {
        if (key === 'JWT_EXPIRES_IN') return '30m';
        if (key === 'JWT_REFRESH_EXPIRES_IN') return '14d';
        return def;
      });

      const user = Mock.user({
        id: randomInt(1, 10000),
        username: randomUsername(),
      });
      const accessToken = randomToken();
      const refreshToken = randomToken();
      mockJwtSign.mockReturnValueOnce(accessToken).mockReturnValueOnce(refreshToken);

      const result = service.generateTokenPair(user as any);

      expect(result).toEqual({ accessToken, refreshToken });
      expect(mockJwtSign).toHaveBeenNthCalledWith(1, expect.any(Object), { expiresIn: '30m' });
      expect(mockJwtSign).toHaveBeenNthCalledWith(2, expect.any(Object), { expiresIn: '14d' });
    });

    it('should handle invalid refresh expiration gracefully', () => {
      mockConfigServiceGet.mockImplementation((key: string, def: any) => {
        if (key === 'JWT_REFRESH_EXPIRES_IN') return '0d'; // Invalid value
        return def;
      });

      const user = Mock.user({
        id: randomInt(1, 10000),
        username: randomUsername(),
      });
      const accessToken = randomToken();
      const refreshToken = randomToken();
      mockJwtSign.mockReturnValueOnce(accessToken).mockReturnValueOnce(refreshToken);

      const result = service.generateTokenPair(user as any);

      expect(result).toEqual({ accessToken, refreshToken });
      // Should fallback to 7 days when invalid - accessing private field for verification
      const storedToken = (service as any).refreshTokens.get(refreshToken);
      expect(storedToken).toBeDefined();
      expect(storedToken.expiresAt.isAfter(dayjs().add(6, 'day'))).toBe(true);
    });
  });

  describe('verifyAccessToken - revoked tokens', () => {
    it('should reject token in memory blacklist', async () => {
      const token = randomToken();
      // Accessing private field for testing purposes - testing blacklist functionality
      (service as any).revokedTokens.add(token);

      await expect(service.verifyAccessToken(token)).rejects.toThrow(UnauthorizedException);
      await expect(service.verifyAccessToken(token)).rejects.toThrow('Token has been revoked');
    });

    it('should reject token in database blacklist', async () => {
      const token = randomToken();
      mockTokenBlacklistService.isTokenRevoked.mockResolvedValueOnce(true);

      await expect(service.verifyAccessToken(token)).rejects.toThrow(UnauthorizedException);
      expect(mockTokenBlacklistService.isTokenRevoked).toHaveBeenCalledWith(token);
      // Should not proceed to verify JWT after blacklist check
      expect(mockJwtVerify).not.toHaveBeenCalled();
    });
  });

  describe('verifyRefreshToken - revoked tokens', () => {
    it('should reject token in memory blacklist', async () => {
      const token = randomToken();
      // Accessing private field for testing purposes - testing blacklist functionality
      (service as any).revokedTokens.add(token);

      await expect(service.verifyRefreshToken(token)).rejects.toThrow(UnauthorizedException);
      await expect(service.verifyRefreshToken(token)).rejects.toThrow(
        'Refresh token has been revoked',
      );
    });
  });

  describe('verifyRefreshToken - JWT errors', () => {
    it('should handle JWT verification errors', async () => {
      const token = randomToken();
      const user = Mock.user({
        id: randomInt(1, 10000),
        username: randomUsername(),
      });
      // Accessing private field for testing purposes - setting up token state
      (service as any).refreshTokens.set(token, {
        token,
        expiresAt: dayjs().add(7, 'day'),
        userId: user.id,
        type: 'refresh',
      });
      mockJwtVerify.mockImplementation(() => {
        throw new Error('JWT malformed');
      });

      await expect(service.verifyRefreshToken(token)).rejects.toThrow(UnauthorizedException);
      await expect(service.verifyRefreshToken(token)).rejects.toThrow(
        'Invalid or expired refresh token',
      );
    });
  });

  describe('revokeToken - database integration', () => {
    it('should add valid token to database blacklist', async () => {
      const token = randomToken();
      const userId = randomInt(1, 10000);
      const mockPayload = {
        sub: userId,
        username: randomUsername(),
        type: UserType.AUTHOR,
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      };

      mockJwtDecode.mockReturnValue(mockPayload);

      await service.revokeToken(token);

      expect(service.isTokenRevoked(token)).toBe(true);
      expect(mockTokenBlacklistService.revokeToken).toHaveBeenCalledWith(
        token,
        'access',
        expect.any(Date),
        userId,
        'Manual revocation',
      );
    });

    it('should handle decode errors gracefully', async () => {
      const token = randomToken();
      mockJwtDecode.mockReturnValue(null);

      await service.revokeToken(token);

      // Should still add to memory blacklist
      expect(service.isTokenRevoked(token)).toBe(true);
      // Should not call database service for invalid tokens
      expect(mockTokenBlacklistService.revokeToken).not.toHaveBeenCalled();
    });

    it('should handle decode exceptions', async () => {
      const token = randomToken();
      mockJwtDecode.mockImplementation(() => {
        throw new Error('Decode failed');
      });

      await service.revokeToken(token);

      // Should still add to memory blacklist
      expect(service.isTokenRevoked(token)).toBe(true);
      expect(mockTokenBlacklistService.revokeToken).not.toHaveBeenCalled();
    });

    it('should handle payload without exp field', async () => {
      const token = randomToken();
      mockJwtDecode.mockReturnValue({
        sub: 1,
        username: 'testuser',
      });

      await service.revokeToken(token);

      expect(service.isTokenRevoked(token)).toBe(true);
      expect(mockTokenBlacklistService.revokeToken).not.toHaveBeenCalled();
    });

    it('should handle payload with invalid exp type', async () => {
      const token = randomToken();
      mockJwtDecode.mockReturnValue({
        sub: 1,
        username: 'testuser',
        exp: 'invalid',
      });

      await service.revokeToken(token);

      expect(service.isTokenRevoked(token)).toBe(true);
      expect(mockTokenBlacklistService.revokeToken).not.toHaveBeenCalled();
    });

    it('should handle payload with zero or negative exp', async () => {
      const token = randomToken();
      mockJwtDecode.mockReturnValue({
        sub: 1,
        username: 'testuser',
        exp: 0,
      });

      await service.revokeToken(token);

      expect(service.isTokenRevoked(token)).toBe(true);
      expect(mockTokenBlacklistService.revokeToken).not.toHaveBeenCalled();
    });

    it('should delete refresh token from map when revoking', async () => {
      const token = randomToken();
      // Accessing private field for testing purposes - testing token cleanup
      (service as any).refreshTokens.set(token, {
        token,
        expiresAt: dayjs().add(1, 'day'),
        userId: 1,
        type: 'refresh',
      });

      expect((service as any).refreshTokens.has(token)).toBe(true);

      await service.revokeToken(token);

      expect((service as any).refreshTokens.has(token)).toBe(false);
    });

    it('should handle token with non-numeric sub (anonymous token)', async () => {
      const token = randomToken();
      const mockPayload = {
        sub: 'anonymous',
        username: randomUsername(),
        type: UserType.VIEWER,
        exp: Math.floor(Date.now() / 1000) + 3600,
        isAnonymous: true,
      };

      mockJwtDecode.mockReturnValue(mockPayload);

      await service.revokeToken(token);

      expect(service.isTokenRevoked(token)).toBe(true);
      expect(mockTokenBlacklistService.revokeToken).toHaveBeenCalledWith(
        token,
        'access',
        expect.any(Date),
        undefined, // userId should be undefined for non-numeric sub
        'Manual revocation',
      );
    });
  });

  describe('cleanupExpiredTokens - revoked tokens cleanup', () => {
    it('should clean up expired revoked tokens older than 24 hours', () => {
      const expiredToken = randomToken();
      const expiredPayload = {
        sub: 1,
        username: 'test',
        exp: Math.floor((Date.now() - 25 * 60 * 60 * 1000) / 1000), // 25 hours ago
      };

      mockJwtDecode.mockReturnValue(expiredPayload);
      // Accessing private field for testing purposes - setting up revoked token
      (service as any).revokedTokens.add(expiredToken);

      service.cleanupExpiredTokens();

      expect(service.isTokenRevoked(expiredToken)).toBe(false);
    });

    it('should keep recently revoked tokens within 24 hours', () => {
      const recentToken = randomToken();
      const recentPayload = {
        sub: 1,
        username: 'test',
        exp: Math.floor((Date.now() - 1 * 60 * 60 * 1000) / 1000), // 1 hour ago
      };

      mockJwtDecode.mockReturnValue(recentPayload);
      // Accessing private field for testing purposes - setting up revoked token
      (service as any).revokedTokens.add(recentToken);

      service.cleanupExpiredTokens();

      expect(service.isTokenRevoked(recentToken)).toBe(true);
    });

    it('should clean up tokens that cannot be decoded', () => {
      const malformedToken = randomToken();
      mockJwtDecode.mockImplementation(() => {
        throw new Error('Decode error');
      });
      // Accessing private field for testing purposes - setting up revoked token
      (service as any).revokedTokens.add(malformedToken);

      service.cleanupExpiredTokens();

      expect(service.isTokenRevoked(malformedToken)).toBe(false);
    });

    it('should not clean up tokens with null payload', () => {
      const nullPayloadToken = randomToken();
      mockJwtDecode.mockReturnValue(null);
      // Accessing private field for testing purposes - setting up revoked token
      (service as any).revokedTokens.add(nullPayloadToken);

      service.cleanupExpiredTokens();

      // Tokens with null payloads are not cleaned up (no exp field to check)
      expect(service.isTokenRevoked(nullPayloadToken)).toBe(true);
    });

    it('should not clean up tokens with non-object payload', () => {
      const stringPayloadToken = randomToken();
      mockJwtDecode.mockReturnValue('not-an-object');
      // Accessing private field for testing purposes - setting up revoked token
      (service as any).revokedTokens.add(stringPayloadToken);

      service.cleanupExpiredTokens();

      // Tokens with non-object payloads are not cleaned up (no exp field to check)
      expect(service.isTokenRevoked(stringPayloadToken)).toBe(true);
    });
  });
});
