import { Controller, Post, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserType } from '../user/dto/create-user.dto';

import { DemoService } from './demo.service';

/**
 * 演示模式控制器
 *
 * 管理演示模式的状态、数据快照和恢复功能。演示模式用于提供
 * 可重置的环境，便于用户体验和测试功能。
 */
@ApiTags('Demo')
@Controller('demo')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  /**
   * 获取演示模式状态
   *
   * 返回当前演示模式的启用状态、快照信息和统计数据。
   *
   * @returns 演示模式状态信息
   */
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

  /**
   * 手动恢复演示数据
   *
   * 将数据库恢复到演示快照状态，清除用户在演示过程中的所有修改。
   * 仅管理员可执行此操作。
   *
   * @returns 恢复操作结果
   */
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

  /**
   * 创建新的演示快照
   *
   * 将当前数据库状态保存为新的演示快照，用于后续的数据恢复。
   * 仅管理员可执行此操作。
   *
   * @returns 快照创建结果
   */
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
