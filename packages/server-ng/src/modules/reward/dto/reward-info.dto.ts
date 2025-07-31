import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RewardInfoDto {
  @ApiProperty({ description: 'Payment method name (e.g., Alipay, WeChat Pay)' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Payment value (e.g., QR code URL or account)' })
  @IsString()
  @IsNotEmpty()
  value!: string;
}
