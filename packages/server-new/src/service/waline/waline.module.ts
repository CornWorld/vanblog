import { Module } from '@nestjs/common';
import { WalineProvider } from './provider/waline.provider';

import getFilterMongoSchemaObjs from 'src/common/utils/filterMongoAllSchema';
import { AnalysisModule } from 'src/service/analysis/analysis.module';
import { AssetManageModule } from 'src/service/assetManage/assetManage.module';
import { AuthModule } from 'src/service/auth/auth.module';
import { BackupModule } from 'src/service/backup/backup.module';
import { ContentManagementModule } from 'src/service/contentManagement/contentManagement.module';
import { IsrModule } from 'src/service/isr/isr.module';
import { MetaModule } from 'src/service/meta/meta.module';
@Module({
  imports: [
    ...getFilterMongoSchemaObjs(),
    AnalysisModule,
    AssetManageModule,
    AuthModule,
    BackupModule,
    ContentManagementModule,
    IsrModule,
    MetaModule,
  ],
  controllers: [],
  providers: [WalineProvider],
})
export class WalineModule {}
