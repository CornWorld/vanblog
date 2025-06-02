import { forwardRef, Module } from '@nestjs/common';
import { WalineProvider } from './provider/waline.provider';

import getFilterMongoSchemaObjs from 'src/common/utils/filterMongoAllSchema';
import { MetaModule } from 'src/service/meta/meta.module';

@Module({
  imports: [
    ...getFilterMongoSchemaObjs(),
    forwardRef(() => MetaModule),
  ],
  controllers: [],
  providers: [WalineProvider],
})
export class WalineModule { }
