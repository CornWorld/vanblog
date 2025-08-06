import { Controller, Post, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserType } from '../user/dto/create-user.dto';

import { DemoService } from './demo.service';

@ApiTags('demo')
@Controller('demo')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get demo mode status' })
  @ApiResponse({
    status: 200,
    description: 'Demo mode status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        isDemoMode: { type: 'boolean' },
        hasSnapshot: { type: 'boolean' },
        timestamp: { type: 'number', nullable: true },
        articlesCount: { type: 'number', nullable: true },
        draftsCount: { type: 'number', nullable: true },
      },
    },
  })
  getStatus(): {
    isDemoMode: boolean;
    hasSnapshot: boolean;
    timestamp?: number;
    articlesCount?: number;
    draftsCount?: number;
  } {
    const snapshotInfo = this.demoService.getSnapshotInfo();
    return {
      isDemoMode: this.demoService.isDemoModeEnabled(),
      ...snapshotInfo,
    };
  }

  @Post('restore')
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Manually restore demo data' })
  @ApiResponse({
    status: 200,
    description: 'Demo data restoration result',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
  })
  async restoreDemo(): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.demoService.manualRestore();
  }

  @Post('snapshot')
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Create a new demo snapshot' })
  @ApiResponse({
    status: 200,
    description: 'Demo snapshot created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
  })
  async createSnapshot(): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      await this.demoService.createSnapshot();
      return {
        success: true,
        message: 'Demo snapshot created successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create snapshot: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
