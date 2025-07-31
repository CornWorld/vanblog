import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCustomCodeDto {
  @ApiPropertyOptional({ description: 'Custom code to inject in <head> tag' })
  @IsOptional()
  @IsString()
  head?: string;

  @ApiPropertyOptional({ description: 'Custom code to inject in <body> tag' })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ description: 'Custom code to inject before </body> tag' })
  @IsOptional()
  @IsString()
  footer?: string;
}
