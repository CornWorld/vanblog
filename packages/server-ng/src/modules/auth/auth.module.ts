import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { DatabaseModule } from '../../database';
import { UserModule } from '../user/user.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PermissionsGuard } from './guards/permissions.guard';
import { LoginLogService } from './login-log.service';
import { PasswordChangeHandlerService } from './password-change-handler.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { TokenBlacklistService } from './token-blacklist.service';
import { TokenService } from './token.service';

import type { StringValue } from 'ms';

@Module({
  imports: [
    forwardRef(() => UserModule),
    PassportModule,
    DatabaseModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const secret = configService.get<string>('JWT_SECRET') ?? 'default-secret-change-me';
        const expiresIn = configService.get<string>('JWT_EXPIRES_IN') ?? '7d';
        return {
          secret,
          signOptions: {
            expiresIn: expiresIn as unknown as StringValue,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    TokenService,
    TokenBlacklistService,
    PasswordChangeHandlerService,
    PermissionsGuard,
    LoginLogService,
  ],
  exports: [AuthService, TokenService, JwtModule],
})
export class AuthModule {}
