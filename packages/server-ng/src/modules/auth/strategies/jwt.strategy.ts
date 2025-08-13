import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { UserType } from '../../user/dto/create-user.dto';
import { User } from '../../user/entities/user.entity';
import { UserService } from '../../user/user.service';
import { TokenService } from '../token.service';

export interface JwtPayload {
  sub: number;
  username: string;
  type: UserType;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly userService: UserService,
    private readonly tokenService: TokenService,
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
    try {
      // Get the raw token from the request
      const token = ExtractJwt.fromAuthHeaderAsBearerToken()(this.getRequest());

      if (!token) {
        throw new UnauthorizedException('No token provided');
      }

      // Check if token is revoked
      if (this.tokenService.isTokenRevoked(token)) {
        throw new UnauthorizedException('Token has been revoked');
      }

      const user = await this.userService.findOne(payload.sub);
      return user;
    } catch (_error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private getRequest(): Request {
    // This will be set by passport during request processing
    return (this as unknown as { request: Request }).request;
  }
}
