import { Module } from '@nestjs/common';
import { AuthProvider } from './provider/auth.provider';
import { TokenProvider } from './provider/token.provider';
import { JwtStrategy } from './strategy/jwt.strategy';
import { LocalStrategy } from './strategy/local.strategy';
import { InitMiddleware } from './middleware/init.middleware';
import { AccessGuard } from './guard/access.guard';
import { LoginGuard } from './guard/login.guard';
import { TokenGuard } from './guard/token.guard';
import { AuthController } from './controller/auth.controller';
import { TokenController } from './controller/token.controller';

@Module({
  imports: [],
  controllers: [
    AuthController,
    TokenController
  ],
  providers: [
    AuthProvider,
    TokenProvider,
    JwtStrategy,
    LocalStrategy,
    InitMiddleware,
    AccessGuard,
    LoginGuard,
    TokenGuard
  ],
})
export class AuthModule { }
