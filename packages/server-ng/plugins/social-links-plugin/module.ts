import { Module, type DynamicModule } from '@nestjs/common';

// Social Links 插件模块，可以被动态加载
@Module({
  imports: [],
  controllers: [],
  providers: [],
  exports: [],
})
class SocialLinksPluginModule {}

// 导出为默认模块用于动态加载
const pluginModule: DynamicModule = {
  module: SocialLinksPluginModule,
  imports: [],
  controllers: [],
  providers: [],
  exports: [],
};

export default pluginModule;
export { pluginModule as SocialLinksPluginModule };
export { pluginModule as PluginModule };
