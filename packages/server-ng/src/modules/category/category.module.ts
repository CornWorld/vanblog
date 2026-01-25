import { Module, forwardRef } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { AuthModule } from '../auth/auth.module';
import { PermissionModule } from '../permission/permission.module';

import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';

@Module({
  imports: [
    SharedModule,
    forwardRef(() => AuthModule),
    PermissionModule.forFeature([
      'category:create',
      'category:read',
      'category:update',
      'category:delete',
    ]),
  ],
  controllers: [CategoryController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
