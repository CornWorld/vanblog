import { Module } from '@nestjs/common';
import { ISRController } from './controller/isr.controller';
import { ISRProvider } from './provider/isr.provider';
import { RssProvider } from './provider/rss.provider';
import getFilterMongoSchemaObjs from 'src/common/utils/filterMongoAllSchema';
import { AnalysisModule } from 'src/service/analysis/analysis.module';
import { AssetManageModule } from 'src/service/assetManage/assetManage.module';
import { ContentManagementModule } from 'src/service/contentManagement/contentManagement.module';
import { BackupModule } from 'src/service/backup/backup.module';
import { AuthModule } from 'src/service/auth/auth.module';
import { MetaModule } from 'src/service/meta/meta.module';
import { WalineModule } from 'src/service/waline/waline.module';
@Module({
  imports: [
    ...getFilterMongoSchemaObjs(),
    AnalysisModule,
    AssetManageModule,
    AuthModule,
    BackupModule,
    ContentManagementModule,
    MetaModule,
    WalineModule,
  ],
  controllers: [ISRController],
  providers: [ISRProvider, RssProvider],
})
export class IsrModule {}
