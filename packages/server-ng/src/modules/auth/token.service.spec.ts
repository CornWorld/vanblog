import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import dayjs from 'dayjs';

import { UserType } from '../user/dto/create-user.dto';
import { UserService } from '../user/user.service';

import { TokenService } from './token.service';

describe('TokenService', () => {
  let service: TokenService;
  let mockJwtSign: ReturnType<typeof vi.fn>;
  let mockJwtVerify: ReturnType<typeof vi.fn>;
  let mockUserServiceFindOne: ReturnType<typeof vi.fn>;
  let mockConfigServiceGet: ReturnType<typeof vi.fn>;

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
      const token = 'refresh-token';
      // seed in-memory store
      (service as any).refreshTokens.set(token, {
        token,
        expiresAt: dayjs().add(7, 'day'),
        userId: mockUser.id,
        type: 'refresh',
      });
      mockJwtVerify.mockReturnValue({
        sub: mockUser.id,
        username: mockUser.username,
        type: mockUser.type,
        tokenType: 'refresh',
      });
      mockUserServiceFindOne.mockResolvedValue({ ...mockUser });

      const result = await service.verifyRefreshToken(token);

      expect(result).toEqual(mockUser);
      expect(mockJwtVerify).toHaveBeenCalledWith(token);
      expect(mockUserServiceFindOne).toHaveBeenCalledWith(mockUser.id);
    });

    it('should not call verify and throw for unknown refresh token', async () => {
      const token = 'unknown-refresh-token';
      await expect(service.verifyRefreshToken(token)).rejects.toThrow(UnauthorizedException);
      expect(mockJwtVerify).not.toHaveBeenCalled();
    });

    it('should throw for wrong token type', async () => {
      const token = 'rt-wrong-type';
      (service as any).refreshTokens.set(token, {
        token,
        expiresAt: dayjs().add(7, 'day'),
        userId: mockUser.id,
        type: 'refresh',
      });
      mockJwtVerify.mockReturnValue({
        sub: mockUser.id,
        username: mockUser.username,
        type: mockUser.type,
        tokenType: 'access',
      });

      await expect(service.verifyRefreshToken(token)).rejects.toThrow(UnauthorizedException);
      expect(mockJwtVerify).toHaveBeenCalledWith(token);
    });

    it('should expire and reject expired refresh token', async () => {
      const token = 'expired-refresh-token';
      (service as any).refreshTokens.set(token, {
        token,
        expiresAt: dayjs().subtract(1, 'hour'),
        userId: mockUser.id,
        type: 'refresh',
      });

      await expect(service.verifyRefreshToken(token)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokenPair', () => {
    it('should refresh token pair successfully', async () => {
      const refreshToken = 'valid-refresh-token';
      // seed valid refresh token
      (service as any).refreshTokens.set(refreshToken, {
        token: refreshToken,
        expiresAt: dayjs().add(7, 'day'),
        userId: mockUser.id,
        type: 'refresh',
      });

      const newAccessToken = 'new-access-token';
      const newRefreshToken = 'new-refresh-token';

      mockJwtVerify.mockReturnValue({
        sub: mockUser.id,
        username: mockUser.username,
        type: mockUser.type,
        tokenType: 'refresh',
      });
      mockUserServiceFindOne.mockResolvedValue({ ...mockUser });
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
    it('should add token to revoked tokens set', () => {
      const token = 'token-to-revoke';
      service.revokeToken(token);
      expect(service.isTokenRevoked(token)).toBe(true);
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all user tokens of the given user', () => {
      const t1 = 'u1-rt-1';
      const t2 = 'u1-rt-2';
      const t3 = 'u2-rt-1';
      (service as any).refreshTokens.set(t1, {
        token: t1,
        expiresAt: dayjs().add(1, 'day'),
        userId: 1,
        type: 'refresh',
      });
      (service as any).refreshTokens.set(t2, {
        token: t2,
        expiresAt: dayjs().add(1, 'day'),
        userId: 1,
        type: 'refresh',
      });
      (service as any).refreshTokens.set(t3, {
        token: t3,
        expiresAt: dayjs().add(1, 'day'),
        userId: 2,
        type: 'refresh',
      });

      service.revokeAllUserTokens(1);

      expect(service.isTokenRevoked(t1)).toBe(true);
      expect(service.isTokenRevoked(t2)).toBe(true);
      expect(service.isTokenRevoked(t3)).toBe(false);
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should clean up expired tokens from in-memory store', async () => {
      const expired = 'expired-rt';
      const active = 'active-rt';
      (service as any).refreshTokens.set(expired, {
        token: expired,
        expiresAt: dayjs().subtract(1, 'hour'),
        userId: 1,
        type: 'refresh',
      });
      (service as any).refreshTokens.set(active, {
        token: active,
        expiresAt: dayjs().add(1, 'hour'),
        userId: 1,
        type: 'refresh',
      });

      service.cleanupExpiredTokens();

      await expect(service.verifyRefreshToken(expired)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getUserActiveTokenCount', () => {
    it('should return active token count for user', () => {
      const uid = 11;
      const a = 'rt-a';
      const b = 'rt-b';
      (service as any).refreshTokens.set(a, {
        token: a,
        expiresAt: dayjs().add(1, 'hour'),
        userId: uid,
        type: 'refresh',
      });
      (service as any).refreshTokens.set(b, {
        token: b,
        expiresAt: dayjs().subtract(1, 'hour'),
        userId: uid,
        type: 'refresh',
      });

      const count = service.getUserActiveTokenCount(uid);
      expect(count).toBe(1);
    });
  });

  describe('isTokenRevoked', () => {
    it('should return false for non-revoked token', () => {
      expect(service.isTokenRevoked('valid-token')).toBe(false);
    });

    it('should return true for revoked token', () => {
      const token = 'revoked-token';
      service.revokeToken(token);
      expect(service.isTokenRevoked(token)).toBe(true);
    });
  });
});
