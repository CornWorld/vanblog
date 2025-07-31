import { IsString, IsBoolean, IsOptional, IsDate } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginLogDto {
  @ApiProperty({ description: 'Username attempting to login' })
  @IsString()
  username!: string;

  @ApiPropertyOptional({ description: 'IP address of the login attempt' })
  @IsOptional()
  @IsString()
  ip?: string;

  @ApiPropertyOptional({ description: 'User agent string' })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiProperty({ description: 'Whether the login was successful' })
  @IsBoolean()
  success!: boolean;

  @ApiPropertyOptional({ description: 'Additional message about the login attempt' })
  @IsOptional()
  @IsString()
  message?: string;
}

export class LoginLogResponseDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  username!: string;

  @ApiPropertyOptional()
  ip?: string;

  @ApiPropertyOptional()
  userAgent?: string;

  @ApiProperty()
  success!: boolean;

  @ApiPropertyOptional()
  message?: string;

  @ApiProperty()
  createdAt!: Date;
}

export class LoginLogQueryDto {
  @ApiPropertyOptional({ description: 'Filter by username' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: 'Filter by success status' })
  @IsOptional()
  @IsBoolean()
  success?: boolean;

  @ApiPropertyOptional({ description: 'Start date for filtering' })
  @IsOptional()
  @IsDate()
  startDate?: Date;

  @ApiPropertyOptional({ description: 'End date for filtering' })
  @IsOptional()
  @IsDate()
  endDate?: Date;
}
