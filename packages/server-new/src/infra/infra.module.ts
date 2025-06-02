import { forwardRef, Module } from '@nestjs/common';
import { CacheProvider } from './cache/cache.provider';
import { LogProvider } from './log/provider/log.provider';
import { LogController } from './log/controller/log.controller';
import { AuthModule } from 'src/service/auth/auth.module';

@Module({
  imports: [
    forwardRef(() => AuthModule)
  ],
  controllers: [
    LogController,
  ],
  providers: [
    CacheProvider,
    LogProvider,
  ],
  exports: [
    CacheProvider,
    LogProvider,
  ]
})
export class InfraModule { }
