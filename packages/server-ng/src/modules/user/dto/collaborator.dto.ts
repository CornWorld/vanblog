import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, IsArray } from 'class-validator';
import type { Permission } from '../../../shared/types/permission';

export class CollaboratorDto {
  @ApiProperty({ description: '用户名' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ description: '密码' })
  @IsString()
  @MinLength(1)
  password!: string;

  @ApiPropertyOptional({ description: '昵称' })
  @IsOptional()
  @IsString()
  nickname?: string;

  @ApiProperty({ description: '权限列表', type: [String] })
  @IsArray()
  @IsString({ each: true })
  permissions!: Permission[];
}
