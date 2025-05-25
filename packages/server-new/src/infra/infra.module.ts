import { Module } from '@nestjs/common';
import { CacheProvider } from './cache/cache.provider';
import { LogProvider } from './log/provider/log.provider';
import { LogController } from './log/controller/log.controller';

@Module({
  imports: [],
  controllers: [
    LogController,
  ],
  providers: [
    CacheProvider,
    LogProvider,
  ],
})
export class InfraModule { }
