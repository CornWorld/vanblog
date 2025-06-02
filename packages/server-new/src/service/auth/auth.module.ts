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

import getFilterMongoSchemaObjs from 'src/common/utils/filterMongoAllSchema';
import { AnalysisModule } from 'src/service/analysis/analysis.module';
import { AssetManageModule } from 'src/service/assetManage/assetManage.module';
import { ContentManagementModule } from 'src/service/contentManagement/contentManagement.module';
import { BackupModule } from 'src/service/backup/backup.module';
import { IsrModule } from 'src/service/isr/isr.module';
import { MetaModule } from 'src/service/meta/meta.module';
import { WalineModule } from 'src/service/waline/waline.module';

@Module({
  imports: [
    ...getFilterMongoSchemaObjs(),
    AnalysisModule,
    AssetManageModule,
    BackupModule,
    ContentManagementModule,
    IsrModule,
    MetaModule,
    WalineModule,
  ],
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
export class AuthModule {}
