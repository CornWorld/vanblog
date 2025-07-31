import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTagDto {
  @ApiProperty({ description: 'Tag name' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ description: 'Tag slug for URL' })
  @IsOptional()
  @IsString()
  slug?: string | null;
}

export class UpdateTagDto extends CreateTagDto {}

export class TagDto extends CreateTagDto {
  @ApiProperty({ description: 'Tag ID' })
  id!: number;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @ApiPropertyOptional({ description: 'Last update timestamp' })
  updatedAt?: Date;
}

export class TagWithCountDto extends TagDto {
  @ApiProperty({ description: 'Number of articles with this tag' })
  articleCount!: number;
}

export class TagListResponseDto {
  @ApiProperty({ description: 'Tag list', type: [TagWithCountDto] })
  data!: TagWithCountDto[];

  @ApiProperty({ description: 'Total count' })
  total!: number;
}
