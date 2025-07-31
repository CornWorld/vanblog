import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import { User } from '../../user/entities/user.entity';
import { LoginLogService } from '../login-log.service';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly authService: AuthService,
    private readonly loginLogService: LoginLogService,
    @Inject(REQUEST) private readonly request: Request,
  ) {
    super();
  }

  async validate(username: string, password: string): Promise<User> {
    const user = await this.authService.validateUser(username, password);

    if (!user) {
      await this.loginLogService.createLog({
        username,
        ip: this.request.ip,
        userAgent: this.request.headers['user-agent'] ?? '',
        success: false,
        message: 'Invalid credentials',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }
}
