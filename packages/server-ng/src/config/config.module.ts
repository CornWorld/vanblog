import { Global, Module, DynamicModule } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigFactory } from '@nestjs/config';

import { ConfigValidationService } from './config-validation.service';
import { validateConfig } from './config.schema';
import { ConfigService } from './config.service';
import databaseConfig from './database.config';

/**
 * 配置模块
 *
 * 使用 @Global() 装饰器声明为全局模块，所有其他模块都可以直接使用配置服务。
 *
 * 功能特性：
 * - 从环境变量加载配置（支持 .env 文件）
 * - 使用 Zod 进行配置验证
 * - 提供类型安全的配置访问接口
 * - 支持配置缓存和变量展开
 * - 根据 NODE_ENV 加载对应的 .env 文件
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true, // 全局可用
      cache: true, // 缓存配置提升性能
      expandVariables: true, // 支持环境变量展开（如 ${VAR_NAME}）
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
      validate: validateConfig, // 使用 Zod 验证配置
      load: [databaseConfig], // 加载数据库配置
    }),
  ],
  providers: [ConfigService, ConfigValidationService],
  exports: [ConfigService, ConfigValidationService, NestConfigModule],
})
export class ConfigModule {
  /**
   * 为特定功能模块注册额外的配置
   *
   * @param config - 配置工厂函数
   * @returns 动态配置模块
   */
  static forFeature(config: ConfigFactory): DynamicModule {
    return NestConfigModule.forFeature(config);
  }
}
