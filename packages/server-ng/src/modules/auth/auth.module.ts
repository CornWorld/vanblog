import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { DatabaseModule } from '../../database';
import { PermissionModule } from '../permission/permission.module';
import { UserModule } from '../user/user.module';

import { ApiTokenController } from './api-token.controller';
import { ApiTokenService } from './api-token.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CsrfController } from './csrf.controller';
import { PermissionsGuard } from './guards/permissions.guard';
import { LoginLogController } from './login-log.controller';
import { LoginLogService } from './login-log.service';
import { PasswordChangeHandlerService } from './password-change-handler.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { TokenBlacklistService } from './token-blacklist.service';
import { TokenService } from './token.service';

@Module({
  imports: [
    forwardRef(() => UserModule),
    PassportModule,
    DatabaseModule,
    PermissionModule.forFeature(['user:read', 'user:create', 'user:update', 'user:delete']),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const secret = configService.get<string>('JWT_SECRET') ?? 'default-secret-change-me';
        const expiresIn = configService.get<string>('JWT_EXPIRES_IN') ?? '7d';
        return {
          secret,
          signOptions: {
            expiresIn,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, CsrfController, LoginLogController, ApiTokenController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    TokenService,
    TokenBlacklistService,
    PasswordChangeHandlerService,
    PermissionsGuard,
    ApiTokenService,
    LoginLogService,
  ],
  exports: [AuthService, TokenService, JwtModule],
})
export class AuthModule {}
