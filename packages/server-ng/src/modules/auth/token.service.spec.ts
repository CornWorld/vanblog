import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import dayjs from 'dayjs';

import { UserType } from '../user/dto/create-user.dto';
import { UserService } from '../user/user.service';

import { TokenBlacklistService } from './token-blacklist.service';
import { TokenService } from './token.service';

describe('TokenService', () => {
  let service: TokenService;
  let mockJwtSign: ReturnType<typeof vi.fn>;
  let mockJwtVerify: ReturnType<typeof vi.fn>;
  let mockUserServiceFindOne: ReturnType<typeof vi.fn>;
  let mockConfigServiceGet: ReturnType<typeof vi.fn>;
  let mockTokenBlacklistService: {
    revokeToken: ReturnType<typeof vi.fn>;
    isTokenRevoked: ReturnType<typeof vi.fn>;
  };

  const mockUser = {
    id: 1,
    username: 'testuser',
    type: UserType.AUTHOR,
  } as const;

  beforeEach(async () => {
    mockJwtSign = vi.fn();
    mockJwtVerify = vi.fn();
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
      const accessToken = 'access-token';
      const refreshToken = 'refresh-token';

      mockJwtSign.mockReturnValueOnce(accessToken).mockReturnValueOnce(refreshToken);

      const result = service.generateTokenPair(mockUser as any);

      expect(result).toEqual({ accessToken, refreshToken });

      expect(mockJwtSign).toHaveBeenCalledTimes(2);
      expect(mockJwtSign).toHaveBeenNthCalledWith(
        1,
        {
          sub: mockUser.id,
          username: mockUser.username,
          type: mockUser.type,
        },
        { expiresIn: '15m' },
      );
      expect(mockJwtSign).toHaveBeenNthCalledWith(
        2,
        {
          sub: mockUser.id,
          username: mockUser.username,
          type: mockUser.type,
          tokenType: 'refresh',
        },
        { expiresIn: '7d' },
      );
    });
  });

  describe('generateAnonymousAccessToken', () => {
    it('should generate anonymous access token with default expires', () => {
      const anonymousToken = 'anonymous-token';
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
      const token = 'anon-token-1h';
      mockJwtSign.mockReturnValue(token);

      const result = service.generateAnonymousAccessToken('guest', '1h');

      expect(result).toBe(token);
      expect(mockJwtSign).toHaveBeenCalledWith(
        {
          sub: 'anonymous',
          username: 'guest',
          type: UserType.VIEWER,
          isAnonymous: true,
        },
        { expiresIn: '1h' },
      );
    });
  });

  describe('verifyAccessToken', () => {
    it('should return virtual user for anonymous payload', async () => {
      const token = 'anonymous-token';
      mockJwtVerify.mockReturnValue({ sub: 'anonymous', username: 'anon', isAnonymous: true });

      const result = await service.verifyAccessToken(token);

      expect(result).toMatchObject({ id: 0, username: 'anon', type: UserType.VIEWER });
      expect(mockJwtVerify).toHaveBeenCalledWith(token);
    });

    it('should return real user for valid token', async () => {
      const token = 'user-token';
      mockJwtVerify.mockReturnValue({
        sub: mockUser.id,
        username: mockUser.username,
        type: mockUser.type,
      });
      mockUserServiceFindOne.mockResolvedValue({ ...mockUser });

      const result = await service.verifyAccessToken(token);

      expect(result).toEqual(mockUser);
      expect(mockJwtVerify).toHaveBeenCalledWith(token);
      expect(mockUserServiceFindOne).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      const token = 'invalid-token';
      mockJwtVerify.mockImplementation(() => {
        throw new Error('bad');
      });

      await expect(service.verifyAccessToken(token)).rejects.toThrow(UnauthorizedException);
      expect(mockJwtVerify).toHaveBeenCalledWith(token);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify refresh token and return user', async () => {
      const user = { ...mockUser };
      const generatedTokens = service.generateTokenPair(user as any);
      const token = generatedTokens.refreshToken;

      mockJwtVerify.mockReturnValue({
        sub: mockUser.id,
        username: mockUser.username,
        type: mockUser.type,
        tokenType: 'refresh',
      });
      mockUserServiceFindOne.mockResolvedValue(user);

      const result = await service.verifyRefreshToken(token);

      expect(result).toEqual(user);
      expect(mockJwtVerify).toHaveBeenCalledWith(token);
      expect(mockUserServiceFindOne).toHaveBeenCalledWith(mockUser.id);
    });

    it('should not call verify and throw for unknown refresh token', async () => {
      const token = 'unknown-refresh-token';
      await expect(service.verifyRefreshToken(token)).rejects.toThrow(UnauthorizedException);
      expect(mockJwtVerify).not.toHaveBeenCalled();
    });

    it('should throw for wrong token type', async () => {
      const user = { ...mockUser };
      const generatedTokens = service.generateTokenPair(user as any);
      const token = generatedTokens.refreshToken;

      mockJwtVerify.mockReturnValue({
        sub: mockUser.id,
        username: mockUser.username,
        type: mockUser.type,
        tokenType: 'access', // Wrong type - should be 'refresh'
      });

      await expect(service.verifyRefreshToken(token)).rejects.toThrow(UnauthorizedException);
      expect(mockJwtVerify).toHaveBeenCalledWith(token);
    });

    it('should expire and reject expired refresh token', async () => {
      // Create a token but let it expire
      const accessToken = 'access-token';
      mockJwtSign.mockReturnValueOnce(accessToken);

      // Manually set an expired refresh token to test expiration

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
      const user = { ...mockUser };
      const generatedTokens = service.generateTokenPair(user as any);
      const { refreshToken } = generatedTokens;

      // Reset mocks to clear previous calls
      vi.clearAllMocks();

      const newAccessToken = 'new-access-token';
      const newRefreshToken = 'new-refresh-token';

      mockJwtVerify.mockReturnValue({
        sub: mockUser.id,
        username: mockUser.username,
        type: mockUser.type,
        tokenType: 'refresh',
      });
      mockUserServiceFindOne.mockResolvedValue(user);
      mockJwtSign.mockReturnValueOnce(newAccessToken).mockReturnValueOnce(newRefreshToken);

      const result = await service.refreshTokenPair(refreshToken);

      expect(result).toEqual({ accessToken: newAccessToken, refreshToken: newRefreshToken });
      expect(mockJwtVerify).toHaveBeenCalledWith(refreshToken);
      expect(mockUserServiceFindOne).toHaveBeenCalledWith(mockUser.id);
      expect(mockJwtSign).toHaveBeenCalledTimes(2);
      expect(service.isTokenRevoked(refreshToken)).toBe(true);
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      const invalid = 'invalid-refresh-token';
      await expect(service.refreshTokenPair(invalid)).rejects.toThrow(UnauthorizedException);
      expect(mockJwtVerify).not.toHaveBeenCalled();
    });
  });

  describe('revokeToken', () => {
    it('should add token to revoked tokens set', async () => {
      const token = 'token-to-revoke';
      await service.revokeToken(token);
      expect(service.isTokenRevoked(token)).toBe(true);
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all user tokens of the given user', () => {
      const user1 = { id: 1, username: 'user1', type: UserType.AUTHOR } as any;
      const user2 = { id: 2, username: 'user2', type: UserType.AUTHOR } as any;

      // Mock JWT sign for consistent token generation
      let signCallCount = 0;
      mockJwtSign.mockImplementation(() => {
        return `token-${String(signCallCount++)}`;
      });

      // Generate tokens for user 1
      const t1 = service.generateTokenPair(user1).refreshToken;
      const t2 = service.generateTokenPair(user1).refreshToken;
      // Generate token for user 2
      const t3 = service.generateTokenPair(user2).refreshToken;

      // Verify tokens are not revoked before
      expect(service.isTokenRevoked(t1)).toBe(false);
      expect(service.isTokenRevoked(t2)).toBe(false);
      expect(service.isTokenRevoked(t3)).toBe(false);

      // Revoke all tokens for user 1
      service.revokeAllUserTokens(1);

      // Verify user 1 tokens are revoked
      expect(service.isTokenRevoked(t1)).toBe(true);
      expect(service.isTokenRevoked(t2)).toBe(true);
      // User 2 token should not be revoked
      expect(service.isTokenRevoked(t3)).toBe(false);
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should clean up expired tokens from in-memory store', async () => {
      const user = { id: 1, username: 'testuser', type: UserType.AUTHOR } as any;

      // Generate token pair (creates active refresh token)
      mockJwtSign.mockReturnValueOnce('access').mockReturnValueOnce('active-rt');
      const tokens = service.generateTokenPair(user);

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
      const user = { id: String(11), username: 'user11', type: UserType.AUTHOR } as any;

      // Generate multiple tokens for same user
      mockJwtSign
        .mockReturnValueOnce('access1')
        .mockReturnValueOnce('refresh1')
        .mockReturnValueOnce('access2')
        .mockReturnValueOnce('refresh2');

      service.generateTokenPair(user);
      service.generateTokenPair(user);

      // Both tokens should be active
      const count = service.getUserActiveTokenCount(String(11));
      expect(count).toBe(2);
    });
  });

  describe('isTokenRevoked', () => {
    it('should return false for non-revoked token', () => {
      expect(service.isTokenRevoked('valid-token')).toBe(false);
    });

    it('should return true for revoked token', async () => {
      const token = 'revoked-token';
      await service.revokeToken(token);
      expect(service.isTokenRevoked(token)).toBe(true);
    });
  });

  describe('revokeAllTokens', () => {
    it('should revoke all tokens in the system', () => {
      const t1 = 'token-1';
      const t2 = 'token-2';
      const t3 = 'token-3';
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
      const t1 = 'token-1';
      const t2 = 'token-2';
      const t3 = 'token-3';
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
      await service.revokeToken('revoked-1');
      await service.revokeToken('revoked-2');

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

      const accessToken = 'access-token-30m';
      const refreshToken = 'refresh-token-14d';
      mockJwtSign.mockReturnValueOnce(accessToken).mockReturnValueOnce(refreshToken);

      const result = service.generateTokenPair(mockUser as any);

      expect(result).toEqual({ accessToken, refreshToken });
      expect(mockJwtSign).toHaveBeenNthCalledWith(1, expect.any(Object), { expiresIn: '30m' });
      expect(mockJwtSign).toHaveBeenNthCalledWith(2, expect.any(Object), { expiresIn: '14d' });
    });

    it('should handle invalid refresh expiration gracefully', () => {
      mockConfigServiceGet.mockImplementation((key: string, def: any) => {
        if (key === 'JWT_REFRESH_EXPIRES_IN') return '0d'; // Invalid value
        return def;
      });

      const accessToken = 'access-token';
      const refreshToken = 'refresh-token';
      mockJwtSign.mockReturnValueOnce(accessToken).mockReturnValueOnce(refreshToken);

      const result = service.generateTokenPair(mockUser as any);

      expect(result).toEqual({ accessToken, refreshToken });
      // Should fallback to 7 days when invalid
      const storedToken = (service as any).refreshTokens.get(refreshToken);
      expect(storedToken).toBeDefined();
      expect(storedToken.expiresAt.isAfter(dayjs().add(6, 'day'))).toBe(true);
    });
  });

  describe('verifyAccessToken - revoked tokens', () => {
    it('should reject token in memory blacklist', async () => {
      const token = 'revoked-in-memory';
      (service as any).revokedTokens.add(token);

      await expect(service.verifyAccessToken(token)).rejects.toThrow(UnauthorizedException);
      await expect(service.verifyAccessToken(token)).rejects.toThrow('Token has been revoked');
    });

    it('should reject token in database blacklist', async () => {
      const token = 'revoked-in-db';
      mockTokenBlacklistService.isTokenRevoked.mockResolvedValueOnce(true);

      await expect(service.verifyAccessToken(token)).rejects.toThrow(UnauthorizedException);
      expect(mockTokenBlacklistService.isTokenRevoked).toHaveBeenCalledWith(token);
      // Should not proceed to verify JWT after blacklist check
      expect(mockJwtVerify).not.toHaveBeenCalled();
    });
  });

  describe('verifyRefreshToken - revoked tokens', () => {
    it('should reject token in memory blacklist', async () => {
      const token = 'revoked-refresh';
      (service as any).revokedTokens.add(token);

      await expect(service.verifyRefreshToken(token)).rejects.toThrow(UnauthorizedException);
      await expect(service.verifyRefreshToken(token)).rejects.toThrow(
        'Refresh token has been revoked',
      );
    });
  });

  describe('verifyRefreshToken - JWT errors', () => {
    it('should handle JWT verification errors', async () => {
      const token = 'malformed-refresh-token';
      (service as any).refreshTokens.set(token, {
        token,
        expiresAt: dayjs().add(7, 'day'),
        userId: mockUser.id,
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
      const token = 'valid-jwt-token';
      const mockPayload = {
        sub: 1,
        username: 'testuser',
        type: UserType.AUTHOR,
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      };

      // Mock JwtService.decode to return a valid payload
      const mockJwtDecode = vi.fn().mockReturnValue(mockPayload);
      (service as any).jwtService.decode = mockJwtDecode;

      await service.revokeToken(token);

      expect(service.isTokenRevoked(token)).toBe(true);
      expect(mockTokenBlacklistService.revokeToken).toHaveBeenCalledWith(
        token,
        'access',
        expect.any(Date),
        1,
        'Manual revocation',
      );
    });

    it('should handle decode errors gracefully', async () => {
      const token = 'invalid-token';
      const mockJwtDecode = vi.fn().mockReturnValue(null);
      (service as any).jwtService.decode = mockJwtDecode;

      await service.revokeToken(token);

      // Should still add to memory blacklist
      expect(service.isTokenRevoked(token)).toBe(true);
      // Should not call database service for invalid tokens
      expect(mockTokenBlacklistService.revokeToken).not.toHaveBeenCalled();
    });

    it('should handle decode exceptions', async () => {
      const token = 'malformed-token';
      const mockJwtDecode = vi.fn().mockImplementation(() => {
        throw new Error('Decode failed');
      });
      (service as any).jwtService.decode = mockJwtDecode;

      await service.revokeToken(token);

      // Should still add to memory blacklist
      expect(service.isTokenRevoked(token)).toBe(true);
      expect(mockTokenBlacklistService.revokeToken).not.toHaveBeenCalled();
    });

    it('should handle payload without exp field', async () => {
      const token = 'token-without-exp';
      const mockJwtDecode = vi.fn().mockReturnValue({
        sub: 1,
        username: 'testuser',
      });
      (service as any).jwtService.decode = mockJwtDecode;

      await service.revokeToken(token);

      expect(service.isTokenRevoked(token)).toBe(true);
      expect(mockTokenBlacklistService.revokeToken).not.toHaveBeenCalled();
    });

    it('should handle payload with invalid exp type', async () => {
      const token = 'token-invalid-exp';
      const mockJwtDecode = vi.fn().mockReturnValue({
        sub: 1,
        username: 'testuser',
        exp: 'invalid',
      });
      (service as any).jwtService.decode = mockJwtDecode;

      await service.revokeToken(token);

      expect(service.isTokenRevoked(token)).toBe(true);
      expect(mockTokenBlacklistService.revokeToken).not.toHaveBeenCalled();
    });

    it('should handle payload with zero or negative exp', async () => {
      const token = 'token-zero-exp';
      const mockJwtDecode = vi.fn().mockReturnValue({
        sub: 1,
        username: 'testuser',
        exp: 0,
      });
      (service as any).jwtService.decode = mockJwtDecode;

      await service.revokeToken(token);

      expect(service.isTokenRevoked(token)).toBe(true);
      expect(mockTokenBlacklistService.revokeToken).not.toHaveBeenCalled();
    });

    it('should delete refresh token from map when revoking', async () => {
      const token = 'refresh-to-delete';
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
      const token = 'anonymous-revoke-token';
      const mockPayload = {
        sub: 'anonymous',
        username: 'guest',
        type: UserType.VIEWER,
        exp: Math.floor(Date.now() / 1000) + 3600,
        isAnonymous: true,
      };

      const mockJwtDecode = vi.fn().mockReturnValue(mockPayload);
      (service as any).jwtService.decode = mockJwtDecode;

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
      const expiredToken = 'expired-revoked-token';
      const expiredPayload = {
        sub: 1,
        username: 'test',
        exp: Math.floor((Date.now() - 25 * 60 * 60 * 1000) / 1000), // 25 hours ago
      };

      const mockJwtDecode = vi.fn().mockReturnValue(expiredPayload);
      (service as any).jwtService.decode = mockJwtDecode;
      (service as any).revokedTokens.add(expiredToken);

      service.cleanupExpiredTokens();

      expect(service.isTokenRevoked(expiredToken)).toBe(false);
    });

    it('should keep recently revoked tokens within 24 hours', () => {
      const recentToken = 'recent-revoked-token';
      const recentPayload = {
        sub: 1,
        username: 'test',
        exp: Math.floor((Date.now() - 1 * 60 * 60 * 1000) / 1000), // 1 hour ago
      };

      const mockJwtDecode = vi.fn().mockReturnValue(recentPayload);
      (service as any).jwtService.decode = mockJwtDecode;
      (service as any).revokedTokens.add(recentToken);

      service.cleanupExpiredTokens();

      expect(service.isTokenRevoked(recentToken)).toBe(true);
    });

    it('should clean up tokens that cannot be decoded', () => {
      const malformedToken = 'malformed-token';
      const mockJwtDecode = vi.fn().mockImplementation(() => {
        throw new Error('Decode error');
      });
      (service as any).jwtService.decode = mockJwtDecode;
      (service as any).revokedTokens.add(malformedToken);

      service.cleanupExpiredTokens();

      expect(service.isTokenRevoked(malformedToken)).toBe(false);
    });

    it('should not clean up tokens with null payload', () => {
      const nullPayloadToken = 'null-payload-token';
      const mockJwtDecode = vi.fn().mockReturnValue(null);
      (service as any).jwtService.decode = mockJwtDecode;
      (service as any).revokedTokens.add(nullPayloadToken);

      service.cleanupExpiredTokens();

      // Tokens with null payloads are not cleaned up (no exp field to check)
      expect(service.isTokenRevoked(nullPayloadToken)).toBe(true);
    });

    it('should not clean up tokens with non-object payload', () => {
      const stringPayloadToken = 'string-payload-token';
      const mockJwtDecode = vi.fn().mockReturnValue('not-an-object');
      (service as any).jwtService.decode = mockJwtDecode;
      (service as any).revokedTokens.add(stringPayloadToken);

      service.cleanupExpiredTokens();

      // Tokens with non-object payloads are not cleaned up (no exp field to check)
      expect(service.isTokenRevoked(stringPayloadToken)).toBe(true);
    });
  });
});
