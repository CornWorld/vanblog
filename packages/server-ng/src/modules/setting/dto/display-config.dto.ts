import { IsBoolean, IsOptional, IsNumber, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateDisplayConfigDto {
  @ApiPropertyOptional({ description: 'Enable comment system' })
  @IsBoolean()
  @IsOptional()
  enableComment?: boolean;

  @ApiPropertyOptional({ description: 'Show sub menu' })
  @IsBoolean()
  @IsOptional()
  showSubMenu?: boolean;

  @ApiPropertyOptional({ description: 'Header left content type', enum: ['siteLogo', 'siteName'] })
  @IsIn(['siteLogo', 'siteName'])
  @IsOptional()
  headerLeftContent?: 'siteLogo' | 'siteName';

  @ApiPropertyOptional({ description: 'Sub menu offset in pixels' })
  @IsNumber()
  @IsOptional()
  subMenuOffset?: number;

  @ApiPropertyOptional({ description: 'Show admin button' })
  @IsBoolean()
  @IsOptional()
  showAdminButton?: boolean;

  @ApiPropertyOptional({ description: 'Show donate information' })
  @IsBoolean()
  @IsOptional()
  showDonateInfo?: boolean;

  @ApiPropertyOptional({ description: 'Show friends section' })
  @IsBoolean()
  @IsOptional()
  showFriends?: boolean;

  @ApiPropertyOptional({ description: 'Show copyright information' })
  @IsBoolean()
  @IsOptional()
  showCopyRight?: boolean;

  @ApiPropertyOptional({ description: 'Show RSS link' })
  @IsBoolean()
  @IsOptional()
  showRSS?: boolean;

  @ApiPropertyOptional({ description: 'Open article links in new window' })
  @IsBoolean()
  @IsOptional()
  openArticleLinksInNewWindow?: boolean;

  @ApiPropertyOptional({ description: 'Show expiration reminder for old articles' })
  @IsBoolean()
  @IsOptional()
  showExpirationReminder?: boolean;

  @ApiPropertyOptional({ description: 'Show edit button' })
  @IsBoolean()
  @IsOptional()
  showEditButton?: boolean;

  @ApiPropertyOptional({ description: 'Default theme', enum: ['auto', 'dark', 'light'] })
  @IsIn(['auto', 'dark', 'light'])
  @IsOptional()
  defaultTheme?: 'auto' | 'dark' | 'light';

  @ApiPropertyOptional({ description: 'Enable customization features' })
  @IsBoolean()
  @IsOptional()
  enableCustomizing?: boolean;
}
