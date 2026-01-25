import { Module, Global } from '@nestjs/common';

import { ConfigModule, ConfigService } from '../config';
import databaseConfig from '../config/database.config';
import { LoggerModule } from '../core/logger/logger.module';
import { LoggerService } from '../core/logger/logger.service';

import { createDatabaseConnection } from './connection';
import { DATABASE_CONNECTION } from './constants';

/**
 * 数据库模块
 *
 * 使用 @Global() 装饰器声明为全局模块，所有其他模块都可以直接使用数据库连接，
 * 无需重复导入 DatabaseModule。
 *
 * 提供功能：
 * - 根据配置创建数据库连接（支持 local/turso/d1）
 * - 提供 Drizzle ORM 数据库实例供其他模块使用
 * - 自动管理数据库连接生命周期
 */
@Global()
@Module({
  imports: [ConfigModule.forFeature(databaseConfig), LoggerModule],
  providers: [
    {
      provide: DATABASE_CONNECTION,
      useFactory: async (configService: ConfigService, logger: LoggerService) => {
        const dbConfig = configService.database;
        return await createDatabaseConnection(dbConfig, logger);
      },
      inject: [ConfigService, LoggerService],
    },
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}
