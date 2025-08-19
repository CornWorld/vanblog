import { Module, Global } from '@nestjs/common';

import { ConfigModule, ConfigService } from '../config';
import databaseConfig from '../config/database.config';
import { LoggerModule } from '../core/logger/logger.module';
import { LoggerService } from '../core/logger/logger.service';

import { createDatabaseConnection } from './connection';

export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';

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
