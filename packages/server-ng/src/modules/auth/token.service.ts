import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import dayjs, { type Dayjs } from 'dayjs';

import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';

import { JwtPayload } from './strategies/jwt.strategy';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface TokenInfo {
  token: string;
  expiresAt: Dayjs;
  userId: number;
  type: 'access' | 'refresh';
}

@Injectable()
export class TokenService {
  private readonly revokedTokens = new Set<string>();
  private readonly refreshTokens = new Map<string, TokenInfo>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {}

  /**
   * 生成访问令牌和刷新令牌对
   */
  generateTokenPair(user: User): TokenPair {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      type: user.type,
    };

    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '15m');
    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');

    const accessToken = this.jwtService.sign(payload, {
      expiresIn,
    });

    const refreshToken = this.jwtService.sign(
      { ...payload, tokenType: 'refresh' },
      {
        expiresIn: refreshExpiresIn,
      },
    );

    // 存储刷新令牌信息
    const refreshDays = parseInt(refreshExpiresIn.replace('d', ''));
    const validRefreshDays = refreshDays > 0 ? refreshDays : 7;
    const refreshExpiresAt = dayjs().add(validRefreshDays, 'day');

    this.refreshTokens.set(refreshToken, {
      token: refreshToken,
      expiresAt: refreshExpiresAt,
      userId: user.id,
      type: 'refresh',
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * 验证访问令牌
   */
  async verifyAccessToken(token: string): Promise<User> {
    if (this.revokedTokens.has(token)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      const user = await this.userService.findOne(payload.sub);
      return user;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * 验证刷新令牌
   */
  async verifyRefreshToken(token: string): Promise<User> {
    if (this.revokedTokens.has(token)) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const tokenInfo = this.refreshTokens.get(token);
    if (!tokenInfo) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (tokenInfo.expiresAt.isBefore(dayjs())) {
      this.refreshTokens.delete(token);
      throw new UnauthorizedException('Refresh token has expired');
    }

    try {
      const payload = this.jwtService.verify<JwtPayload & { tokenType: string }>(token);
      if (payload.tokenType !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      const user = await this.userService.findOne(payload.sub);
      return user;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * 使用刷新令牌生成新的令牌对
   */
  async refreshTokenPair(refreshToken: string): Promise<TokenPair> {
    const user = await this.verifyRefreshToken(refreshToken);

    // 撤销旧的刷新令牌
    this.revokeToken(refreshToken);

    // 生成新的令牌对
    return this.generateTokenPair(user);
  }

  /**
   * 撤销令牌
   */
  revokeToken(token: string): void {
    this.revokedTokens.add(token);
    this.refreshTokens.delete(token);
  }

  /**
   * 撤销用户的所有令牌
   */
  revokeAllUserTokens(userId: number): void {
    // 撤销所有刷新令牌
    for (const [token, tokenInfo] of this.refreshTokens.entries()) {
      if (tokenInfo.userId === userId) {
        this.revokedTokens.add(token);
        this.refreshTokens.delete(token);
      }
    }
  }

  /**
   * 清理过期的令牌
   */
  cleanupExpiredTokens(): void {
    const now = dayjs();
    for (const [token, tokenInfo] of this.refreshTokens.entries()) {
      if (tokenInfo.expiresAt.isBefore(now)) {
        this.refreshTokens.delete(token);
      }
    }
  }

  /**
   * 获取用户的活跃令牌数量
   */
  getUserActiveTokenCount(userId: number): number {
    let count = 0;
    for (const tokenInfo of this.refreshTokens.values()) {
      if (tokenInfo.userId === userId && tokenInfo.expiresAt.isAfter(dayjs())) {
        count++;
      }
    }
    return count;
  }

  /**
   * 检查令牌是否被撤销
   */
  isTokenRevoked(token: string): boolean {
    return this.revokedTokens.has(token);
  }
}
