import { forwardRef, Module } from '@nestjs/common';
import { ISRController } from './controller/isr.controller';
import { ISRProvider } from './provider/isr.provider';
import { RssProvider } from './provider/rss.provider';
import getFilterMongoSchemaObjs from 'src/common/utils/filterMongoAllSchema';
import { ContentManagementModule } from 'src/service/contentManagement/contentManagement.module';
import { AuthModule } from 'src/service/auth/auth.module';
import { MetaModule } from '../meta/meta.module';
@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => ContentManagementModule),
    forwardRef(() => MetaModule),
    ...getFilterMongoSchemaObjs(),
  ],
  controllers: [ISRController],
  providers: [ISRProvider, RssProvider],
  exports: [ISRProvider, RssProvider],
})
export class IsrModule { }
