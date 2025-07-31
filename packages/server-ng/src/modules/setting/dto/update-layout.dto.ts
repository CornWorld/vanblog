import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, Min, Max } from 'class-validator';

export class UpdateLayoutDto {
  @ApiProperty({ description: '是否显示最近文章' })
  @IsBoolean()
  showRecentPosts!: boolean;

  @ApiProperty({ description: '最近文章数量', minimum: 1, maximum: 20 })
  @IsNumber()
  @Min(1)
  @Max(20)
  recentPostsCount!: number;

  @ApiProperty({ description: '是否显示分类' })
  @IsBoolean()
  showCategories!: boolean;

  @ApiProperty({ description: '是否显示标签' })
  @IsBoolean()
  showTags!: boolean;

  @ApiProperty({ description: '是否显示归档' })
  @IsBoolean()
  showArchive!: boolean;

  @ApiProperty({ description: '是否显示关于' })
  @IsBoolean()
  showAbout!: boolean;

  @ApiProperty({ description: '是否显示搜索' })
  @IsBoolean()
  showSearch!: boolean;
}
