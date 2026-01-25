import { ApiProperty } from '@nestjs/swagger';

export class CategoryStatisticsDto {
  @ApiProperty({ description: 'Category ID' })
  id!: number;

  @ApiProperty({ description: 'Category name' })
  name!: string;

  @ApiProperty({ description: 'Category slug' })
  slug?: string | null;

  @ApiProperty({ description: 'Number of articles in this category' })
  articleCount!: number;

  @ApiProperty({ description: 'Number of published articles in this category' })
  publishedCount!: number;

  @ApiProperty({ description: 'Number of private articles in this category' })
  privateCount!: number;

  @ApiProperty({ description: 'Total views of articles in this category' })
  totalViews!: number;
}

export class TagStatisticsDto {
  @ApiProperty({ description: 'Tag ID' })
  id!: number;

  @ApiProperty({ description: 'Tag name' })
  name!: string;

  @ApiProperty({ description: 'Tag slug' })
  slug?: string | null;

  @ApiProperty({ description: 'Number of articles with this tag' })
  articleCount!: number;

  @ApiProperty({ description: 'Total views of articles with this tag' })
  totalViews!: number;
}

export class OverallStatisticsDto {
  @ApiProperty({ description: 'Total number of categories' })
  totalCategories!: number;

  @ApiProperty({ description: 'Total number of tags' })
  totalTags!: number;

  @ApiProperty({ description: 'Total number of articles' })
  totalArticles!: number;

  @ApiProperty({ description: 'Total number of published articles' })
  publishedArticles!: number;

  @ApiProperty({ description: 'Total number of private articles' })
  privateArticles!: number;

  @ApiProperty({ description: 'Total number of hidden articles' })
  hiddenArticles!: number;

  @ApiProperty({ description: 'Total views across all articles' })
  totalViews!: number;

  @ApiProperty({ description: 'Categories statistics', type: [CategoryStatisticsDto] })
  categories!: CategoryStatisticsDto[];

  @ApiProperty({ description: 'Tags statistics', type: [TagStatisticsDto] })
  tags!: TagStatisticsDto[];
}
