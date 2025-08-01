import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePipelineDto {
  @ApiProperty({ description: 'Pipeline name' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Pipeline description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Whether pipeline is enabled', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ description: 'Event name to trigger this pipeline' })
  @IsString()
  eventName!: string;

  @ApiProperty({ description: 'Pipeline script code' })
  @IsString()
  script!: string;

  @ApiPropertyOptional({ description: 'Dependencies array', default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deps?: string[];

  @ApiPropertyOptional({ description: 'Event type', default: 'system' })
  @IsOptional()
  @IsString()
  eventType?: string;
}
