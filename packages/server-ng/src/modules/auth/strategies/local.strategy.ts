import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';

import { User } from '../../user/entities/user.entity';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async validate(username: string, password: string): Promise<User> {
    try {
      const user = await this.authService.validateUser(username, password);

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      return user;
    } catch (_e: unknown) {
      // 统一对外表现为未授权，避免将内部错误泄露给调用方
      throw new UnauthorizedException('Invalid credentials');
    }
  }
}
