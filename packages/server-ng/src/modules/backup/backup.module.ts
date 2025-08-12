import { Module } from '@nestjs/common';

import { LoggerModule } from '../../core/logger/logger.module';
import { DatabaseModule } from '../../database/database.module';

import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';

@Module({
  imports: [DatabaseModule, LoggerModule],
  controllers: [BackupController],
  providers: [BackupService],
  exports: [BackupService],
})
export class BackupModule {}
