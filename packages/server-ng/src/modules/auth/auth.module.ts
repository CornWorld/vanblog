import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { DatabaseModule } from '../../database/database.module';
import { UserModule } from '../user/user.module';

import { AuthV1Controller } from './auth-v1.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginLogService } from './login-log.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { TokenService } from './token.service';

@Module({
  imports: [
    UserModule,
    PassportModule,
    DatabaseModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, AuthV1Controller],
  providers: [AuthService, LocalStrategy, JwtStrategy, LoginLogService, TokenService],
  exports: [AuthService, LoginLogService, TokenService],
})
export class AuthModule {}
