import { Test, type TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcrypt';
import { User } from '../user/entities/user.entity';
import { UserType } from '../user/dto';
import { vi } from 'vitest';

vi.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;

  const mockUser = new User({
    id: 1,
    username: 'testuser',
    password: 'hashedPassword',
    nickname: 'Test User',
    type: UserType.ADMIN,
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const mockUserService = {
    findByUsername: vi.fn(),
    findOne: vi.fn(),
  };

  const mockJwtService = {
    sign: vi.fn(),
    verify: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user when credentials are valid', async () => {
      mockUserService.findByUsername.mockResolvedValue(mockUser);
      (vi.mocked(bcrypt.compare) as any).mockResolvedValue(true);

      const result = await service.validateUser('testuser', 'password');

      expect(result).toEqual(mockUser);
      expect(mockUserService.findByUsername).toHaveBeenCalledWith('testuser');
      expect(bcrypt.compare).toHaveBeenCalledWith('password', 'hashedPassword');
    });

    it('should return null when user not found', async () => {
      mockUserService.findByUsername.mockResolvedValue(null);

      const result = await service.validateUser('testuser', 'password');

      expect(result).toBeNull();
      expect(mockUserService.findByUsername).toHaveBeenCalledWith('testuser');
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should return null when password is invalid', async () => {
      mockUserService.findByUsername.mockResolvedValue(mockUser);
      (vi.mocked(bcrypt.compare) as any).mockResolvedValue(false);

      const result = await service.validateUser('testuser', 'wrongpassword');

      expect(result).toBeNull();
      expect(bcrypt.compare).toHaveBeenCalledWith('wrongpassword', 'hashedPassword');
    });
  });

  describe('login', () => {
    it('should return access token and user info', () => {
      const token = 'jwt.token.here';
      mockJwtService.sign.mockReturnValue(token);

      const result = service.login(mockUser);

      expect(result).toEqual({
        access_token: token,
        user: {
          id: mockUser.id,
          username: mockUser.username,
          nickname: mockUser.nickname,
          email: mockUser.email,
          avatar: mockUser.avatar,
          type: mockUser.type,
          permissions: mockUser.permissions,
          createdAt: mockUser.createdAt,
          updatedAt: mockUser.updatedAt,
        },
      });
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        username: mockUser.username,
        type: mockUser.type,
      });
    });
  });

  describe('verifyToken', () => {
    it('should return user when token is valid', async () => {
      const payload = { sub: 1, username: 'testuser', type: UserType.ADMIN };
      mockJwtService.verify.mockReturnValue(payload);
      mockUserService.findOne.mockResolvedValue(mockUser);

      const result = await service.verifyToken('valid.token');

      expect(result).toEqual(mockUser);
      expect(mockJwtService.verify).toHaveBeenCalledWith('valid.token');
      expect(mockUserService.findOne).toHaveBeenCalledWith(1);
    });

    it('should throw UnauthorizedException when token is invalid', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.verifyToken('invalid.token')).rejects.toThrow(
        new UnauthorizedException('Invalid token'),
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      const payload = { sub: 1, username: 'testuser', type: UserType.ADMIN };
      mockJwtService.verify.mockReturnValue(payload);
      mockUserService.findOne.mockRejectedValue(new UnauthorizedException('User not found'));

      await expect(service.verifyToken('valid.token')).rejects.toThrow(
        new UnauthorizedException('User not found'),
      );
    });
  });
});
