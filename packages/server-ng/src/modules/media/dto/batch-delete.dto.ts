import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, ArrayMinSize } from 'class-validator';

export class BatchDeleteDto {
  @ApiProperty({ description: '要删除的文件 ID 列表', type: [Number] })
  @IsArray()
  @IsNumber({}, { each: true })
  @ArrayMinSize(1)
  ids!: number[];
}
