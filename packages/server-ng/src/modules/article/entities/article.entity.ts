import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class Article {
  @ApiProperty({ description: 'Article ID' })
  id!: number;

  @ApiProperty({ description: 'Article title' })
  title!: string;

  @ApiProperty({ description: 'Article content' })
  content!: string;

  @ApiPropertyOptional({ description: 'Custom pathname' })
  pathname!: string | null;

  @ApiPropertyOptional({ description: 'Tags', type: [String] })
  tags!: string[] | null;

  @ApiPropertyOptional({ description: 'Category' })
  category!: string | null;

  @ApiProperty({ description: 'Author' })
  author!: string;

  @ApiPropertyOptional({ description: 'Pin priority' })
  top!: number | null;

  @ApiPropertyOptional({ description: 'Hidden status' })
  hidden!: boolean | null;

  @ApiPropertyOptional({ description: 'Private status' })
  private!: boolean | null;

  @ApiPropertyOptional({ description: 'Password for private articles' })
  password!: string | null;

  @ApiProperty({ description: 'View count' })
  viewer!: number | null;

  @ApiProperty({ description: 'Creation date' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt!: Date;

  constructor(partial: Partial<Article>) {
    Object.assign(this, partial);
  }
}
