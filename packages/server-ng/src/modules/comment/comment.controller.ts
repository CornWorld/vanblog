import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { DemoModeGuard } from '../auth/guards/demo-mode.guard';
import { Perm } from '../auth/permissions.decorator';

import { WalineSettingSchema, UpdateWalineSettingSchema } from './comment.schema';
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
  })
  async getWalineSetting(): Promise<z.infer<typeof WalineSettingSchema>> {
    return this.commentService.getWalineSetting();
  }

  @Put('waline')
  @UseGuards(DemoModeGuard)
  @Perm('comment', ['write'])
  @ApiOperation({ summary: 'Update Waline settings' })
  @ApiResponse({
    status: 200,
    description: 'Waline settings updated successfully',
  })
  async updateWalineSetting(@Body() raw: unknown): Promise<z.infer<typeof WalineSettingSchema>> {
    const updateDto = UpdateWalineSettingSchema.parse(raw);
    return this.commentService.updateWalineSetting(updateDto);
  }

  @Post('waline/restart')
  @UseGuards(DemoModeGuard)
  @Perm('comment', ['write'])
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
  @Perm('comment', ['read'])
  @ApiOperation({ summary: 'Get Waline service status' })
  @ApiResponse({
    status: 200,
    description: 'Waline service status retrieved successfully',
  })
  getWalineStatus(): { running: boolean; pid?: number } {
    return this.commentService.getStatus();
  }
}
