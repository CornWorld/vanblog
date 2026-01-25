import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { dayjs } from '@vanblog/shared';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { UserType } from '../../user/dto/create-user.dto';
import { User } from '../../user/entities/user.entity';
import { UserService } from '../../user/user.service';

export interface JwtPayload {
  sub: number | 'anonymous';
  username: string;
  type: UserType;
  role?: string;
  isAnonymous?: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly userService: UserService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    // 处理匿名用户令牌
    if (payload.isAnonymous === true || payload.sub === 'anonymous') {
      // 创建虚拟的匿名用户对象
      return new User({
        id: 0, // 使用 0 作为匿名用户 ID
        username: payload.username,
        type: UserType.VIEWER, // 明确的 viewer 类型
        permissions: ['role:viewer'], // 默认 viewer 角色权限
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      });
    }

    try {
      const user = await this.userService.findOne(payload.sub);
      return user;
    } catch (_e: unknown) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
