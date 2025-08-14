import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';

import { DemoModeGuard } from '../auth/guards/demo-mode.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { UpdateWalineSettingDto, WalineSettingDto } from './comment.dto';
import { UpdateWalineSettingSchema } from './comment.schema';
import { CommentService } from './comment.service';

@ApiTags('Comment')
@Controller('comment')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Get('waline')
  @ApiOperation({ summary: 'Get Waline settings' })
  @ApiResponse({
    status: 200,
    description: 'Waline settings retrieved successfully',
    type: WalineSettingDto,
  })
  async getWalineSetting(): Promise<WalineSettingDto> {
    return this.commentService.getWalineSetting();
  }

  @Put('waline')
  @UseGuards(JwtAuthGuard, DemoModeGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update Waline settings' })
  @ApiResponse({
    status: 200,
    description: 'Waline settings updated successfully',
    type: WalineSettingDto,
  })
  async updateWalineSetting(
    @Body(new ZodValidationPipe(UpdateWalineSettingSchema)) updateDto: UpdateWalineSettingDto,
  ): Promise<WalineSettingDto> {
    return this.commentService.updateWalineSetting(updateDto);
  }

  @Post('waline/restart')
  @UseGuards(JwtAuthGuard, DemoModeGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restart Waline service' })
  @ApiResponse({
    status: 200,
    description: 'Waline service restarted successfully',
  })
  async restartWaline(): Promise<{ message: string }> {
    await this.commentService.restart('手动重启');
    return { message: 'Waline service restarted successfully' };
  }

  @Get('waline/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Waline service status' })
  @ApiResponse({
    status: 200,
    description: 'Waline service status retrieved successfully',
  })
  getWalineStatus(): { running: boolean; pid?: number } {
    return this.commentService.getStatus();
  }
}
