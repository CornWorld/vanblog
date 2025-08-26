import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import dayjs from 'dayjs';

import { HookService } from '../plugin/services/hook.service';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';

import { TokenService, TokenPair } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly hookService: HookService,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Validates user credentials against the database
   * @param username - The username to validate
   * @param password - The plain text password to verify
   * @returns The user object if validation succeeds, null otherwise
   */
  async validateUser(username: string, password: string): Promise<User | null> {
    // Execute beforeValidateUser action
    await this.hookService.doAction('auth|beforeValidateUser', { username });

    const user = await this.userService.findByUsernameWithPassword(username);
    if (!user) {
      // Execute validateUserFailed action
      await this.hookService.doAction('auth|validateUserFailed', {
        username,
        reason: 'user_not_found',
      });
      return null;
    }

    if (!user.password) {
      // Execute validateUserFailed action
      await this.hookService.doAction('auth|validateUserFailed', {
        username,
        reason: 'no_password',
      });
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      // Execute validateUserFailed action
      await this.hookService.doAction('auth|validateUserFailed', {
        username,
        reason: 'invalid_password',
      });
      return null;
    }

    // Return user without password for further use
    const userWithoutPassword = await this.userService.findByUsername(username);

    // Execute afterValidateUser action
    await this.hookService.doAction('auth|validatedUser', { user: userWithoutPassword });

    return userWithoutPassword;
  }

  /**
   * Generates JWT tokens for authenticated user
   * @param user - The authenticated user object
   * @returns Object containing access_token, refresh_token, and user data
   *
   * JWT Payload Structure:
   * {
   *   sub: number, // User ID
   *   username: string, // Username
   *   type: string, // User type (e.g., 'admin', 'collaborator')
   *   permissions: string[], // User permissions array
   *   iat: number, // Issued at timestamp
   *   exp: number // Expiration timestamp
   * }
   */
  login(user: User): { access_token: string; refresh_token: string; user: Omit<User, 'password'> } {
    // Execute beforeLogin action
    this.hookService.doAction('auth|beforeLogin', { user }).catch(() => {});

    const tokenPair = this.tokenService.generateTokenPair(user);

    const result = {
      access_token: tokenPair.accessToken,
      refresh_token: tokenPair.refreshToken,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        email: user.email,
        avatar: user.avatar,
        type: user.type,
        permissions: user.permissions,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };

    // Execute afterLogin action
    this.hookService
      .doAction('auth|loggedIn', { user, token: result.access_token })
      .catch(() => {});

    return result;
  }

  /**
   * Verifies and decodes a JWT token
   * @param token - The JWT token to verify
   * @returns The user object associated with the token
   * @throws UnauthorizedException if token is invalid or expired
   */
  async verifyToken(token: string): Promise<User> {
    return this.tokenService.verifyAccessToken(token);
  }

  /**
   * Refreshes an access token using a valid refresh token
   * @param refreshToken - The refresh token to use for generating new tokens
   * @returns New token pair (access_token and refresh_token)
   * @throws UnauthorizedException if refresh token is invalid
   */
  async refreshToken(refreshToken: string): Promise<TokenPair> {
    return this.tokenService.refreshTokenPair(refreshToken);
  }

  /**
   * Revokes a specific JWT token by adding it to the blacklist
   * @param token - The JWT token to revoke
   */
  revokeToken(token: string): void {
    this.tokenService.revokeToken(token);
  }

  /**
   * 为匿名访客生成访问令牌
   * @param customExpiresIn - 可选的自定义过期时间
   * @returns 匿名访客令牌
   */
  generateAnonymousToken(customExpiresIn?: string): { access_token: string; expiresAt: string } {
    const accessToken = this.tokenService.generateAnonymousAccessToken(
      'anonymous',
      customExpiresIn,
    );

    // 计算过期时间
    const expiresIn = customExpiresIn ?? '12h';
    const hours = parseInt(expiresIn.replace('h', ''));
    const expiresAt = dayjs().add(hours, 'hour').toISOString();

    return {
      access_token: accessToken,
      expiresAt,
    };
  }

  /**
   * Revokes all tokens for a specific user
   * @param userId - The ID of the user whose tokens should be revoked
   */
  revokeAllUserTokens(userId: number): void {
    this.tokenService.revokeAllUserTokens(userId);
  }
}
