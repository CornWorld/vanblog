import { Module } from '@nestjs/common';
import { WalineProvider } from './provider/waline.provider';
import getFilterMongoSchemaObjs from 'src/common/utils/filterMongoAllSchema';

@Module({
  imports: [...getFilterMongoSchemaObjs()],
  controllers: [],
  providers: [WalineProvider],
})
export class WalineModule {}
