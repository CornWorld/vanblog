import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyCategoryPasswordDto {
  @ApiProperty({ description: 'Password for private category' })
  @IsString()
  @MinLength(1)
  password!: string;
}

export class CategoryAccessResponseDto {
  @ApiProperty({ description: 'Whether access is granted' })
  success!: boolean;

  @ApiProperty({ description: 'Access token for the category' })
  token?: string;

  @ApiProperty({ description: 'Error message if access is denied' })
  message?: string;
}
