import { Module } from '@nestjs/common';
import { BackupController } from './controller/backup.controller';
import getFilterMongoSchemaObjs from 'src/common/utils/filterMongoAllSchema';
import { AnalysisModule } from 'src/service/analysis/analysis.module';
import { AssetManageModule } from 'src/service/assetManage/assetManage.module';
import { ContentManagementModule } from 'src/service/contentManagement/contentManagement.module';
import { MetaModule } from 'src/service/meta/meta.module';
@Module({
  imports: [
    ...getFilterMongoSchemaObjs(),
    AnalysisModule,
    AssetManageModule,
    ContentManagementModule,
    MetaModule,
  ],
  controllers: [BackupController],
  providers: [],
})
export class BackupModule { }
