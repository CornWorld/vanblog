import { Module } from '@nestjs/common';

import { LoggerModule } from '../../core/logger/logger.module';
import { DatabaseModule } from '../../database';
import { PermissionModule } from '../permission/permission.module';

import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';

@Module({
  imports: [
    DatabaseModule,
    LoggerModule,
    PermissionModule.forFeature([
      'backup:create',
      'backup:read',
      'backup:download',
      'backup:delete',
      'backup:restore',
    ]),
  ],
  controllers: [BackupController],
  providers: [BackupService],
  exports: [BackupService],
})
export class BackupModule {}
