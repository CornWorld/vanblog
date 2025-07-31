import { IsOptional, IsBoolean, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePaymentInfoDto {
  @ApiPropertyOptional({ description: 'Alipay QR code URL' })
  @IsUrl()
  @IsOptional()
  payAliPay?: string;

  @ApiPropertyOptional({ description: 'WeChat Pay QR code URL' })
  @IsUrl()
  @IsOptional()
  payWechat?: string;

  @ApiPropertyOptional({ description: 'Alipay QR code URL (dark mode)' })
  @IsUrl()
  @IsOptional()
  payAliPayDark?: string;

  @ApiPropertyOptional({ description: 'WeChat Pay QR code URL (dark mode)' })
  @IsUrl()
  @IsOptional()
  payWechatDark?: string;

  @ApiPropertyOptional({ description: 'Show donate button' })
  @IsBoolean()
  @IsOptional()
  showDonateButton?: boolean;

  @ApiPropertyOptional({ description: 'Show donate info in about page' })
  @IsBoolean()
  @IsOptional()
  showDonateInAbout?: boolean;
}
