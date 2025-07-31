import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class Article {
  @ApiProperty({ description: 'Article ID' })
  id!: number;

  @ApiProperty({ description: 'Article title' })
  title!: string;

  @ApiProperty({ description: 'Article content' })
  content!: string;

  @ApiPropertyOptional({ description: 'Custom pathname' })
  pathname?: string;

  @ApiPropertyOptional({ description: 'Tags', type: [String] })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Category' })
  category?: string;

  @ApiProperty({ description: 'Author' })
  author!: string;

  @ApiPropertyOptional({ description: 'Pin priority' })
  top?: number;

  @ApiPropertyOptional({ description: 'Hidden status' })
  hidden?: boolean;

  @ApiPropertyOptional({ description: 'Private status' })
  private?: boolean;

  @ApiPropertyOptional({ description: 'Password for private articles' })
  password?: string;

  @ApiProperty({ description: 'View count' })
  viewer!: number;

  @ApiProperty({ description: 'Creation date' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt!: Date;

  constructor(partial: Partial<Article>) {
    Object.assign(this, partial);
  }
}
