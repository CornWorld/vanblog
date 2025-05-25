import { Module } from '@nestjs/common';
import { WalineProvider } from './provider/waline.provider';

@Module({
  imports: [],
  controllers: [],
  providers: [
    WalineProvider
  ],
})
export class WalineModule { }
