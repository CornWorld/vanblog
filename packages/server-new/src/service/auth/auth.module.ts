import { Module } from '@nestjs/common';
import { AuthController } from './controller/auth.controller';
import { TokenController } from './controller/token.controller';
import { AuthProvider } from './provider/auth.provider';
import { TokenProvider } from './provider/token.provider';
import { UserProvider } from './provider/user.provider';
import { JwtStrategy } from './strategy/jwt.strategy';
import { LocalStrategy } from './strategy/local.strategy';
import { InitMiddleware } from './middleware/init.middleware';
import { AccessGuard } from './guard/access.guard';
import { LoginGuard } from './guard/login.guard';
import { TokenGuard } from './guard/token.guard';

@Module({
  imports: [],
  controllers: [AuthController, TokenController],
  providers: [
    AuthProvider,
    TokenProvider,
    UserProvider,
    JwtStrategy,
    LocalStrategy,
    InitMiddleware,
    AccessGuard,
    LoginGuard,
    TokenGuard,
  ],
})
export class AuthModule { }
