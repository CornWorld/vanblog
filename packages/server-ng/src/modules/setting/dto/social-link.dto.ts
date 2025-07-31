import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSocialLinkDto {
  @ApiProperty({ description: 'Social platform type' })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiProperty({ description: 'Social link URL' })
  @IsString()
  @IsNotEmpty()
  value!: string;

  @ApiPropertyOptional({ description: 'Custom icon URL' })
  @IsString()
  @IsOptional()
  icon?: string;
}
