import { IsString, IsOptional, IsArray, IsNotEmpty, IsInt, Min } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateDraftDto {
  @ApiProperty({ description: 'Draft title' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ description: 'Draft content in markdown' })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiProperty({ description: 'Custom URL pathname', required: false })
  @IsString()
  @IsOptional()
  pathname?: string;

  @ApiProperty({ description: 'Tags array', required: false, type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiProperty({ description: 'Category name', required: false })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ description: 'Author username', required: false })
  @IsString()
  @IsOptional()
  author?: string;
}

export class UpdateDraftDto extends PartialType(CreateDraftDto) {}

export class DraftDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty({ required: false })
  pathname?: string;

  @ApiProperty({ type: [String] })
  tags!: string[];

  @ApiProperty({ required: false })
  category?: string;

  @ApiProperty()
  author!: string;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class DraftListResponseDto {
  @ApiProperty({ type: [DraftDto] })
  data!: DraftDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}

export class DraftQueryDto {
  @ApiProperty({ required: false, default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ required: false, default: 10, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  pageSize?: number = 10;

  @ApiProperty({ required: false, description: 'Search keyword' })
  @IsString()
  @IsOptional()
  keyword?: string;

  @ApiProperty({ required: false, description: 'Filter by author' })
  @IsString()
  @IsOptional()
  author?: string;

  @ApiProperty({ required: false, enum: ['createdAt', 'updatedAt', 'title'], default: 'updatedAt' })
  @IsString()
  @IsOptional()
  sortBy?: 'createdAt' | 'updatedAt' | 'title' = 'updatedAt';

  @ApiProperty({ required: false, enum: ['asc', 'desc'], default: 'desc' })
  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class PublishDraftDto {
  @ApiProperty({ description: 'Top priority', required: false, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  top?: number;

  @ApiProperty({ description: 'Hidden status', required: false })
  @IsOptional()
  hidden?: boolean;

  @ApiProperty({ description: 'Private status', required: false })
  @IsOptional()
  private?: boolean;

  @ApiProperty({ description: 'Password for private article', required: false })
  @IsString()
  @IsOptional()
  password?: string;
}

export class DraftVersionDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  draftId!: number;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty({ required: false })
  pathname?: string;

  @ApiProperty({ type: [String] })
  tags!: string[];

  @ApiProperty({ required: false })
  category?: string;

  @ApiProperty()
  author!: string;

  @ApiProperty()
  createdAt!: Date;
}

export class DraftVersionListResponseDto {
  @ApiProperty({ type: [DraftVersionDto] })
  data!: DraftVersionDto[];

  @ApiProperty()
  total!: number;
}
