import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

import { BeianInfo } from './beian.schema';
import { BeianService } from './beian.service';
import { BeianInfoDto, BeianInfoSchema } from './dto/beian-info.dto';

@ApiTags('beian')
@Controller('api/admin/beian')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class BeianController {
  constructor(private readonly beianService: BeianService) {}

  @Get()
  @Permissions('setting:read')
  @ApiOperation({ summary: 'Get beian information' })
  async getBeianInfo(): Promise<BeianInfo> {
    return this.beianService.getBeianInfo();
  }

  @Put()
  @Permissions('setting:update')
  @ApiOperation({ summary: 'Update beian information' })
  async updateBeianInfo(
    @Body(new ZodValidationPipe(BeianInfoSchema)) dto: BeianInfoDto,
  ): Promise<BeianInfo> {
    return this.beianService.updateBeianInfo(dto);
  }
}
