import { Module } from '@nestjs/common';
import { BackupController } from './controller/backup.controller';

@Module({
  imports: [],
  controllers: [
    BackupController
  ],
  providers: [],
})
export class BackupModule { }

