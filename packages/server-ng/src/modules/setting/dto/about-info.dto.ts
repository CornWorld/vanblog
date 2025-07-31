import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAboutContentDto {
  @ApiProperty({ description: 'About page content in Markdown format' })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
