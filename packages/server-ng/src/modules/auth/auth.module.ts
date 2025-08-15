import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { DatabaseModule } from '../../database/database.module';
import { UserModule } from '../user/user.module';
import { AuthV1Controller } from '../v1/auth-v1.controller';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginLogService } from './login-log.service';
import { PasswordChangeHandlerService } from './password-change-handler.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
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
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, AuthV1Controller],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    LoginLogService,
    TokenService,
    PasswordChangeHandlerService,
  ],
  exports: [AuthService, LoginLogService, TokenService],
})
export class AuthModule {}
