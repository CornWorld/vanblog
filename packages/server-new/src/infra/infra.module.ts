import { Module } from '@nestjs/common';
import { CacheProvider } from './cache/cache.provider';

@Module({
  imports: [],
  controllers: [],
  providers: [
    CacheProvider
  ],
})
export class InfraModule { }
