import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUrl } from 'class-validator';

export class CreateFriendLinkDto {
  @ApiProperty({ description: '友链名称' })
  @IsString()
  name!: string;

  @ApiProperty({ description: '友链地址' })
  @IsUrl()
  url!: string;

  @ApiProperty({ description: '友链描述', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: '友链头像', required: false })
  @IsOptional()
  @IsUrl()
  avatar?: string;
}

export class UpdateFriendLinkDto extends CreateFriendLinkDto {}
