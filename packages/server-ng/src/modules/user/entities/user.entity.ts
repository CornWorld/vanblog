import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { UserType } from '../dto/create-user.dto';

import type { Permission } from '../../../shared/types/permission.type';

export class User {
  @ApiProperty({ description: '用户ID' })
  id!: number;

  @ApiProperty({ description: '用户名' })
  username!: string;

  @ApiPropertyOptional({ description: '昵称' })
  nickname?: string;

  @ApiPropertyOptional({ description: '邮箱' })
  email?: string;

  @ApiPropertyOptional({ description: '头像URL' })
  avatar?: string;

  @ApiProperty({ description: '用户类型', enum: UserType })
  type!: UserType;

  @ApiPropertyOptional({ description: '权限列表', type: [String] })
  permissions?: Permission[];

  @ApiProperty({ description: '创建时间' })
  createdAt!: string;

  @ApiProperty({ description: '更新时间' })
  updatedAt!: string;

  // Password field excluded from serialization via transform logic
  password?: string;

  constructor(partial: Partial<User>) {
    Object.assign(this, partial);
  }
}
