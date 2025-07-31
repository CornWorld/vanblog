import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { BeianService } from './beian.service';
import { BeianInfoDto } from './dto/beian-info.dto';
import { BeianInfo } from './beian.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('beian')
@Controller('api/admin/beian')
export class BeianController {
  constructor(private readonly beianService: BeianService) {}

  @Get()
  @ApiOperation({ summary: 'Get beian information' })
  async getBeianInfo(): Promise<BeianInfo> {
    return this.beianService.getBeianInfo();
  }

  @Put()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update beian information' })
  async updateBeianInfo(@Body() dto: BeianInfoDto): Promise<BeianInfo> {
    return this.beianService.updateBeianInfo(dto);
  }
}
