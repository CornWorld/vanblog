import { IsString, IsOptional, IsBoolean, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ description: 'Category name' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ description: 'Category slug for URL' })
  @IsOptional()
  @IsString()
  slug?: string | null;

  @ApiPropertyOptional({ description: 'Category description' })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ description: 'Make category private (password protected)' })
  @IsOptional()
  @IsBoolean()
  private?: boolean | null;

  @ApiPropertyOptional({ description: 'Password for private categories' })
  @IsOptional()
  @IsString()
  password?: string | null;
}

export class UpdateCategoryDto extends CreateCategoryDto {}

export class CategoryDto extends CreateCategoryDto {
  @ApiProperty({ description: 'Category ID' })
  id!: number;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;
}

export class CategoryWithCountDto extends CategoryDto {
  @ApiProperty({ description: 'Number of articles in this category' })
  articleCount!: number;
}

export class CategoryListResponseDto {
  @ApiProperty({ description: 'Category list', type: [CategoryWithCountDto] })
  data!: CategoryWithCountDto[];

  @ApiProperty({ description: 'Total count' })
  total!: number;
}
