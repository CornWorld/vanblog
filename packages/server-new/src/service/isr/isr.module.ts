import { Module } from '@nestjs/common';
import { ISRController } from './controller/isr.controller';
import { ISRProvider } from './provider/isr.provider';
import { RssProvider } from './provider/rss.provider';
import getFilterMongoSchemaObjs from 'src/common/utils/filterMongoAllSchema';

@Module({
  imports: [...getFilterMongoSchemaObjs()],
  controllers: [ISRController],
  providers: [ISRProvider, RssProvider],
})
export class IsrModule {}
