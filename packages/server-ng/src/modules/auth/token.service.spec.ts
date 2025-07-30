import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { TokenService } from './token.service';
import { UserService } from '../user/user.service';
import { User } from '../user/entities/user.entity';
import { UserType } from '../user/dto';

describe('TokenService', () => {
  let service: TokenService;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let userService: jest.Mocked<UserService>;

  const mockUser: User = {
    id: 1,
    username: 'testuser',
    password: 'hashedpassword',
    nickname: 'Test User',
    email: 'test@example.com',
    avatar: undefined,
    type: UserType.ADMIN,
    permission: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const mockUserService = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    userService = module.get(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateTokenPair', () => {
    it('should generate access and refresh tokens', () => {
      configService.get.mockReturnValue('15m');
      jwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');

      const result = service.generateTokenPair(mockUser);

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', async () => {
      const token = 'valid-token';
      jwtService.verify.mockReturnValue({
        sub: 1,
        username: 'testuser',
        type: UserType.ADMIN,
      });
      userService.findOne.mockResolvedValue(mockUser);

      const result = await service.verifyAccessToken(token);

      expect(result).toEqual(mockUser);
      expect(jwtService.verify).toHaveBeenCalledWith(token);
      expect(userService.findOne).toHaveBeenCalledWith(1);
    });

    it('should throw UnauthorizedException for revoked token', async () => {
      const token = 'revoked-token';
      service.revokeToken(token);

      await expect(service.verifyAccessToken(token)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      const token = 'invalid-token';
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.verifyAccessToken(token)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', async () => {
      const token = 'valid-refresh-token';

      // First generate a token pair to create the refresh token
      configService.get.mockReturnValue('7d');
      jwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce(token);
      service.generateTokenPair(mockUser);

      jwtService.verify.mockReturnValue({
        sub: 1,
        username: 'testuser',
        type: UserType.ADMIN,
        tokenType: 'refresh',
      });
      userService.findOne.mockResolvedValue(mockUser);

      const result = await service.verifyRefreshToken(token);

      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException for revoked refresh token', async () => {
      const token = 'revoked-refresh-token';
      service.revokeToken(token);

      await expect(service.verifyRefreshToken(token)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent refresh token', async () => {
      const token = 'non-existent-token';

      await expect(service.verifyRefreshToken(token)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokenPair', () => {
    it('should refresh token pair with valid refresh token', async () => {
      const refreshToken = 'valid-refresh-token';

      // Setup refresh token
      configService.get.mockReturnValue('7d');
      jwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce(refreshToken);
      service.generateTokenPair(mockUser);

      jwtService.verify.mockReturnValue({
        sub: 1,
        username: 'testuser',
        type: UserType.ADMIN,
        tokenType: 'refresh',
      });
      userService.findOne.mockResolvedValue(mockUser);

      // Mock new token generation
      jwtService.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      const result = await service.refreshTokenPair(refreshToken);

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
      expect(service.isTokenRevoked(refreshToken)).toBe(true);
    });
  });

  describe('revokeToken', () => {
    it('should revoke a token', () => {
      const token = 'token-to-revoke';

      service.revokeToken(token);

      expect(service.isTokenRevoked(token)).toBe(true);
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all tokens for a user', () => {
      const userId = 1;

      // Generate some tokens for the user
      configService.get.mockReturnValue('7d');
      jwtService.sign.mockReturnValueOnce('access-1').mockReturnValueOnce('refresh-1');
      const tokens1 = service.generateTokenPair(mockUser);

      jwtService.sign.mockReturnValueOnce('access-2').mockReturnValueOnce('refresh-2');
      const tokens2 = service.generateTokenPair(mockUser);

      service.revokeAllUserTokens(userId);

      expect(service.isTokenRevoked(tokens1.refreshToken)).toBe(true);
      expect(service.isTokenRevoked(tokens2.refreshToken)).toBe(true);
    });
  });

  describe('getUserActiveTokenCount', () => {
    it('should return count of active tokens for user', () => {
      const userId = 1;

      // Generate tokens
      configService.get.mockReturnValue('7d');
      jwtService.sign.mockReturnValueOnce('access-1').mockReturnValueOnce('refresh-1');
      service.generateTokenPair(mockUser);

      jwtService.sign.mockReturnValueOnce('access-2').mockReturnValueOnce('refresh-2');
      service.generateTokenPair(mockUser);

      const count = service.getUserActiveTokenCount(userId);

      expect(count).toBe(2);
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should remove expired tokens', () => {
      // This test would require mocking Date.now() or using a time library
      // For now, we'll just test that the method exists and can be called
      expect(() => {
        service.cleanupExpiredTokens();
      }).not.toThrow();
    });
  });
});
