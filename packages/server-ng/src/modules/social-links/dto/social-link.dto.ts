import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SocialLinkDto {
  @ApiProperty({ description: 'Social media platform type (e.g., github, twitter, email)' })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiProperty({ description: 'URL or contact information' })
  @IsString()
  @IsNotEmpty()
  url!: string;
}
