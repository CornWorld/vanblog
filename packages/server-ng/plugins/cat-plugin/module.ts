import { Module } from '@nestjs/common';

// 🐱插件模块，可以被动态加载
@Module({
  imports: [],
  controllers: [],
  providers: [],
  exports: [],
})
export class CatPluginModule {
  constructor() {
    console.log('🐱插件模块已加载！');
  }
}

// 导出为默认模块用于动态加载
export default CatPluginModule;
