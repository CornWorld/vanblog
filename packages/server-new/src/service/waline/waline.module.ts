import { forwardRef, Module } from '@nestjs/common';
import { WalineProvider } from './provider/waline.provider';

import getFilterMongoSchemaObjs from 'src/common/utils/filterMongoAllSchema';
import { AuthModule } from '../auth/auth.module';
import { MetaModule } from '../meta/meta.module';

@Module({
  imports: [
    ...getFilterMongoSchemaObjs(),
    forwardRef(() => MetaModule),
    forwardRef(() => AuthModule)
  ],
  controllers: [],
  providers: [WalineProvider],
  exports: [WalineProvider]
})
export class WalineModule { }
