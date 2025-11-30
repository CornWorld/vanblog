import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { DatabaseModule } from '../../database';
import { UserModule } from '../user/user.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthTsRestController } from './auth.ts-rest.controller';
import { PermissionsGuard } from './guards/permissions.guard';
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
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d') as any,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, AuthTsRestController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    LoginLogService,
    TokenService,
    TokenBlacklistService,
    PasswordChangeHandlerService,
    PermissionsGuard,
  ],
  exports: [AuthService, LoginLogService, TokenService],
})
export class AuthModule {}
