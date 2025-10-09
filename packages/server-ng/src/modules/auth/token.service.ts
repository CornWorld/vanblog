import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import dayjs, { type Dayjs } from 'dayjs';

import { UserType } from '../user/dto/create-user.dto';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';

import { JwtPayload } from './strategies/jwt.strategy';
import { TokenBlacklistService } from './token-blacklist.service';

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
  private readonly logger = new Logger(TokenService.name);
  private readonly revokedTokens = new Set<string>();
  private readonly refreshTokens = new Map<string, TokenInfo>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly tokenBlacklistService: TokenBlacklistService,
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
   * 为匿名访客生成短期访问令牌（不包含刷新令牌）
   */
  generateAnonymousAccessToken(username = 'anonymous', customExpiresIn?: string): string {
    const payload: JwtPayload = {
      sub: 'anonymous',
      username,
      type: UserType.VIEWER,
      isAnonymous: true,
    };

    const expiresIn =
      customExpiresIn ?? this.configService.get<string>('JWT_GUEST_EXPIRES_IN', '12h');

    return this.jwtService.sign(payload, { expiresIn });
  }

  /**
   * 验证访问令牌
   */
  async verifyAccessToken(token: string): Promise<User> {
    // 检查内存黑名单（向后兼容）
    if (this.revokedTokens.has(token)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    // 检查数据库黑名单
    if (await this.tokenBlacklistService.isTokenRevoked(token)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);

      // 匿名访客：返回虚拟用户
      if (payload.isAnonymous === true || payload.sub === 'anonymous') {
        const { username } = payload;
        return new User({
          id: 0,
          username,
          type: UserType.VIEWER,
          permissions: ['role:viewer'],
          createdAt: dayjs().toISOString(),
          updatedAt: dayjs().toISOString(),
        });
      }

      const user = await this.userService.findOne(payload.sub);
      return user;
    } catch (_e: unknown) {
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

      const user = await this.userService.findOne(payload.sub as number);
      return user;
    } catch (_e: unknown) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * 使用刷新令牌生成新的令牌对
   */
  async refreshTokenPair(refreshToken: string): Promise<TokenPair> {
    const user = await this.verifyRefreshToken(refreshToken);

    // 撤销旧的刷新令牌
    await this.revokeToken(refreshToken);

    // 生成新的令牌对
    return this.generateTokenPair(user);
  }

  /**
   * 撤销令牌
   */
  async revokeToken(token: string): Promise<void> {
    // 保持内存黑名单（向后兼容）
    this.revokedTokens.add(token);
    this.refreshTokens.delete(token);

    // 添加到数据库黑名单
    try {
      const payload: unknown = this.jwtService.decode(token);
      if (payload !== null && typeof payload === 'object' && 'exp' in payload) {
        const payloadWithExp = payload as { exp: unknown };
        if (typeof payloadWithExp.exp === 'number' && payloadWithExp.exp > 0) {
          const jwtPayload = payload as unknown as JwtPayload & { exp: number };
          const expiresAt = new Date(jwtPayload.exp * 1000);
          // 根据令牌内容判断类型，默认为 access
          const tokenType = 'access'; // 简化处理，因为 JwtPayload 没有 tokenType 属性
          const userId = typeof jwtPayload.sub === 'number' ? jwtPayload.sub : undefined;

          await this.tokenBlacklistService.revokeToken(
            token,
            tokenType,
            expiresAt,
            userId,
            'Manual revocation',
          );
        }
      }
    } catch (error) {
      // 如果解码失败，仍然添加到内存黑名单
      this.logger.warn('Failed to decode token for database blacklist', { error });
    }
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
   * 撤销所有令牌（系统级操作）
   */
  revokeAllTokens(): void {
    // 将所有刷新令牌添加到撤销列表
    for (const token of this.refreshTokens.keys()) {
      this.revokedTokens.add(token);
    }
    this.refreshTokens.clear();
  }

  /**
   * 清理过期的令牌
   */
  cleanupExpiredTokens(): void {
    const now = dayjs();

    // 清理过期的刷新令牌
    for (const [token, tokenInfo] of this.refreshTokens.entries()) {
      if (tokenInfo.expiresAt.isBefore(now)) {
        this.refreshTokens.delete(token);
      }
    }

    // 清理过期的撤销令牌（保留24小时）
    const expiredRevokedTokens = new Set<string>();
    for (const token of this.revokedTokens) {
      try {
        const payload: unknown = this.jwtService.decode(token);
        if (payload !== null && typeof payload === 'object' && 'exp' in payload) {
          const tokenPayload = payload as Record<string, unknown>;
          if (
            typeof tokenPayload.exp === 'number' &&
            tokenPayload.exp * 1000 < now.valueOf() - 24 * 60 * 60 * 1000
          ) {
            expiredRevokedTokens.add(token);
          }
        }
      } catch {
        // 无法解码的令牌也清理掉
        expiredRevokedTokens.add(token);
      }
    }

    for (const token of expiredRevokedTokens) {
      this.revokedTokens.delete(token);
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

  /**
   * 获取系统令牌统计信息
   */
  getTokenStats(): {
    activeRefreshTokens: number;
    revokedTokens: number;
    totalUsers: number;
  } {
    const userIds = new Set<number>();
    for (const tokenInfo of this.refreshTokens.values()) {
      userIds.add(tokenInfo.userId);
    }

    return {
      activeRefreshTokens: this.refreshTokens.size,
      revokedTokens: this.revokedTokens.size,
      totalUsers: userIds.size,
    };
  }
}
