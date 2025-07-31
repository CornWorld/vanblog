import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRewardInfoDto {
  @ApiProperty({ description: 'Payment method name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Payment value (e.g., QR code URL)' })
  @IsString()
  @IsNotEmpty()
  value!: string;
}
