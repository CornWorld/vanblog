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
import { MetaModule } from '../meta/meta.module';
import { initJwt } from '../../common/utils/initJwt';
import { JwtModule } from '@nestjs/jwt';
import { InfraModule } from 'src/infra/infra.module';
import getFilterMongoSchemaObjs from 'src/common/utils/filterMongoAllSchema';

@Module({
  imports: [
    MetaModule,
    JwtModule.registerAsync({
      useFactory: async () => {
        return {
          secret: await initJwt(),
          signOptions: {
            expiresIn: 3600 * 24 * 7,
          },
        };
      },
    }),
    InfraModule,
    ...getFilterMongoSchemaObjs()
  ],
  controllers: [
    AuthController,
    TokenController
  ],
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
