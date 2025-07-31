import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UploadFileDto {
  @ApiProperty({ type: 'string', format: 'binary', description: '要上传的文件' })
  file!: Express.Multer.File;

  @ApiProperty({ description: '自定义文件名', required: false })
  @IsOptional()
  @IsString()
  filename?: string;

  @ApiProperty({ description: '存储提供商', required: false, default: 'local' })
  @IsOptional()
  @IsString()
  provider?: string;
}
