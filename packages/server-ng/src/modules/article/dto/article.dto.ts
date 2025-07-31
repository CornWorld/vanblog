import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateArticleDto {
  @ApiProperty({ description: 'Article title' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ description: 'Article content (Markdown)' })
  @IsString()
  content!: string;

  @ApiPropertyOptional({ description: 'Custom pathname for the article' })
  @IsOptional()
  @IsString()
  pathname?: string;

  @ApiPropertyOptional({ description: 'Article tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Article category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Article author' })
  @IsOptional()
  @IsString()
  author?: string;

  @ApiPropertyOptional({ description: 'Pin priority (0 means not pinned)' })
  @IsOptional()
  @IsNumber()
  top?: number;

  @ApiPropertyOptional({ description: 'Hide article from public' })
  @IsOptional()
  @IsBoolean()
  hidden?: boolean;

  @ApiPropertyOptional({ description: 'Make article private (password protected)' })
  @IsOptional()
  @IsBoolean()
  private?: boolean;

  @ApiPropertyOptional({ description: 'Password for private articles' })
  @IsOptional()
  @IsString()
  password?: string;
}

export class UpdateArticleDto extends CreateArticleDto {}

export class ArticleDto extends CreateArticleDto {
  @ApiProperty({ description: 'Article ID' })
  id!: number;

  @ApiProperty({ description: 'View count' })
  viewer!: number;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;
}

export class ArticleQueryDto {
  @ApiPropertyOptional({ description: 'Page number' })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: 'Page size' })
  @IsOptional()
  @IsNumber()
  pageSize?: number;

  @ApiPropertyOptional({ description: 'Search keyword' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: 'Filter by category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Filter by tag' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ description: 'Include hidden articles' })
  @IsOptional()
  @IsBoolean()
  includeHidden?: boolean;

  @ApiPropertyOptional({ description: 'Sort field' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}

export class ArticleListResponseDto {
  @ApiProperty({ description: 'Article list', type: [ArticleDto] })
  data!: ArticleDto[];

  @ApiProperty({ description: 'Total count' })
  total!: number;

  @ApiProperty({ description: 'Current page' })
  page!: number;

  @ApiProperty({ description: 'Page size' })
  pageSize!: number;
}

export class ArticleSearchDto {
  @ApiProperty({ description: 'Search query' })
  @IsString()
  @MinLength(1)
  query!: string;

  @ApiPropertyOptional({ description: 'Search in title only' })
  @IsOptional()
  @IsBoolean()
  titleOnly?: boolean;

  @ApiPropertyOptional({ description: 'Search in content only' })
  @IsOptional()
  @IsBoolean()
  contentOnly?: boolean;

  @ApiPropertyOptional({ description: 'Filter by category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Filter by tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Include hidden articles' })
  @IsOptional()
  @IsBoolean()
  includeHidden?: boolean;

  @ApiPropertyOptional({ description: 'Include private articles' })
  @IsOptional()
  @IsBoolean()
  includePrivate?: boolean;

  @ApiPropertyOptional({ description: 'Page number' })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: 'Page size' })
  @IsOptional()
  @IsNumber()
  pageSize?: number;

  @ApiPropertyOptional({ description: 'Sort field' })
  @IsOptional()
  @IsString()
  sortBy?: 'relevance' | 'createdAt' | 'updatedAt' | 'viewer';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}

export class ArticleSearchResultDto extends ArticleDto {
  @ApiPropertyOptional({ description: 'Search relevance score' })
  relevance?: number;

  @ApiPropertyOptional({ description: 'Highlighted title with search matches' })
  highlightedTitle?: string;

  @ApiPropertyOptional({ description: 'Content excerpt with search matches' })
  excerpt?: string;
}

export class ArticleSearchResponseDto {
  @ApiProperty({ description: 'Search results', type: [ArticleSearchResultDto] })
  data!: ArticleSearchResultDto[];

  @ApiProperty({ description: 'Total count' })
  total!: number;

  @ApiProperty({ description: 'Current page' })
  page!: number;

  @ApiProperty({ description: 'Page size' })
  pageSize!: number;

  @ApiProperty({ description: 'Search query' })
  query!: string;

  @ApiProperty({ description: 'Search execution time in milliseconds' })
  searchTime!: number;
}
