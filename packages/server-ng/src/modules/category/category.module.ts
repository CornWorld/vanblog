import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { PermissionModule } from '../permission/permission.module';

import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { CategoryTsRestController } from './category.ts-rest.controller';

@Module({
  imports: [
    SharedModule,
    PermissionModule.forFeature([
      'category:create',
      'category:read',
      'category:update',
      'category:delete',
    ]),
  ],
  controllers: [CategoryController, CategoryTsRestController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
