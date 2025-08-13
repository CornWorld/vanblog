import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

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
    await this.hookService.doAction('auth|afterValidateUser', { user: userWithoutPassword });

    return userWithoutPassword;
  }

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
      .doAction('auth|afterLogin', { user, token: result.access_token })
      .catch(() => {});

    return result;
  }

  async verifyToken(token: string): Promise<User> {
    return this.tokenService.verifyAccessToken(token);
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    return this.tokenService.refreshTokenPair(refreshToken);
  }

  revokeToken(token: string): void {
    this.tokenService.revokeToken(token);
  }

  revokeAllUserTokens(userId: number): void {
    this.tokenService.revokeAllUserTokens(userId);
  }
}
