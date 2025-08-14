import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

import { SocialLinkDto, SocialLinkSchema } from './social-links.dto';
import { SocialLink } from './social-links.schema';
import { SocialLinksService } from './social-links.service';

@ApiTags('social-links')
@Controller('api/admin/social-links')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class SocialLinksController {
  constructor(private readonly socialLinksService: SocialLinksService) {}

  @Get()
  @Permissions('setting:read')
  @ApiOperation({ summary: 'Get all social links' })
  async getSocialLinks(): Promise<SocialLink[]> {
    return this.socialLinksService.getSocialLinks();
  }

  @Post()
  @Permissions('setting:update')
  @ApiOperation({ summary: 'Add or update a social link' })
  async addOrUpdateSocialLink(
    @Body(new ZodValidationPipe(SocialLinkSchema)) dto: SocialLinkDto,
  ): Promise<SocialLink[]> {
    return this.socialLinksService.addOrUpdateSocialLink(dto);
  }

  @Delete(':type')
  @Permissions('setting:update')
  @ApiOperation({ summary: 'Delete a social link' })
  @ApiParam({ name: 'type', description: 'Social link type' })
  async deleteSocialLink(@Param('type') type: string): Promise<SocialLink[]> {
    return this.socialLinksService.deleteSocialLink(type);
  }
}
