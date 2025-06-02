import { Module } from '@nestjs/common';
import { ISRController } from './controller/isr.controller';
import { ISRProvider } from './provider/isr.provider';
import { RssProvider } from './provider/rss.provider';
import getFilterMongoSchemaObjs from 'src/common/utils/filterMongoAllSchema';
import { ContentManagementModule } from 'src/service/contentManagement/contentManagement.module';
import { AuthModule } from 'src/service/auth/auth.module';
import { MetaModule } from 'src/service/meta/meta.module';
@Module({
  imports: [...getFilterMongoSchemaObjs(), AuthModule, ContentManagementModule, MetaModule],
  controllers: [ISRController],
  providers: [ISRProvider, RssProvider],
})
export class IsrModule {}
