import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database';
import { PermissionModule } from '../permission/permission.module';

import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [
    DatabaseModule,
    PermissionModule.forFeature(['user:create', 'user:read', 'user:update', 'user:delete']),
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
