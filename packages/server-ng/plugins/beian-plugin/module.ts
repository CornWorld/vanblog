import { Module } from '@nestjs/common';

import type { DynamicModule } from '@nestjs/common';

// Beian 插件模块，可以被动态加载
@Module({
  imports: [],
  controllers: [],
  providers: [],
  exports: [],
})
class BeianPluginModule {
  constructor() {
    // Beian 插件模块已加载
  }
}

// 导出为默认模块用于动态加载
const pluginModule: DynamicModule = {
  module: BeianPluginModule,
  imports: [],
  controllers: [],
  providers: [],
  exports: [],
};

export default pluginModule;
export { pluginModule as BeianPluginModule };
export { pluginModule as PluginModule };
