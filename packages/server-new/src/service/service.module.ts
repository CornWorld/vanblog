import { Module } from '@nestjs/common';
import { AnalysisModule } from './analysis/analysis.module';
import { AssetManageModule } from './assetManage/assetManage.module';
import { AuthModule } from './auth/auth.module';
import { BackupModule } from './backup/backup.module';
import { ContentManagementModule } from './contentManagement/contentManagement.module';
import { IsrModule } from './isr/isr.module';
import { MetaModule } from './meta/meta.module';
import { WalineModule } from './waline/waline.module';

@Module({
  imports: [
    AnalysisModule,
    AssetManageModule,
    AuthModule,
    BackupModule,
    ContentManagementModule,
    IsrModule,
    MetaModule,
    WalineModule,
  ],
  controllers: [],
  providers: [],
})
export class ServiceModule { }
