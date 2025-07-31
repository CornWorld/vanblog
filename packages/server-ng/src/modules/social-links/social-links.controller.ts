import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { SocialLinksService, SocialLink } from './social-links.service';
import { SocialLinkDto } from './dto/social-link.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

@ApiTags('social-links')
@Controller('api/admin/social-links')
export class SocialLinksController {
  constructor(private readonly socialLinksService: SocialLinksService) {}

  @Get()
  @ApiOperation({ summary: 'Get all social links' })
  async getSocialLinks(): Promise<SocialLink[]> {
    return this.socialLinksService.getSocialLinks();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add or update a social link' })
  async addOrUpdateSocialLink(@Body() dto: SocialLinkDto): Promise<SocialLink[]> {
    return this.socialLinksService.addOrUpdateSocialLink(dto);
  }

  @Delete(':type')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a social link' })
  @ApiParam({ name: 'type', description: 'Social link type' })
  async deleteSocialLink(@Param('type') type: string): Promise<SocialLink[]> {
    return this.socialLinksService.deleteSocialLink(type);
  }
}
