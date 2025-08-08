import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { HookService } from '../plugin/services/hook.service';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';

import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly hookService: HookService,
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

  login(user: User): { access_token: string; user: Omit<User, 'password'> } {
    // Execute beforeLogin action
    this.hookService.doAction('auth|beforeLogin', { user }).catch(() => {});

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      type: user.type,
    };

    const result = {
      access_token: this.jwtService.sign(payload),
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
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      const user = await this.userService.findOne(payload.sub);
      return user;
    } catch (error) {
      throw error instanceof UnauthorizedException
        ? error
        : new UnauthorizedException('Invalid token');
    }
  }
}
