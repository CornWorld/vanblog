import * as fs from 'fs';
import * as path from 'path';

import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  StreamableFile,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@vanblog/shared';
import { z } from 'zod';

import { Perm } from '../auth/permissions.decorator';

import { BackupService } from './backup.service';
import {
  CreateBackupSchema,
  RestoreBackupSchema,
  GetBackupsSchema,
  BackupInfoSchema,
  BackupListSchema,
  RestoreProgressSchema,
} from './dto/backup.dto';

import type { Response } from 'express';

/**
 * 备份控制器
 *
 * 提供数据库备份和恢复功能，包括创建备份、列出备份、
 * 下载备份文件、删除备份以及从备份恢复数据库等操作。
 */
@ApiTags('Backup')
@Controller({ path: 'backup', version: '2' })
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  /**
   * 创建数据库备份
   *
   * 根据指定的配置创建数据库备份文件。支持自定义备份名称和描述，
   * 备份文件将保存在系统指定的备份目录中。
   *
   * @param createBackupDto 创建备份的配置参数
   * @returns 备份信息，包括文件名、大小、创建时间等
   * @throws {BadRequestException} 当备份参数无效时
   * @throws {UnauthorizedException} 当用户未认证时
   * @throws {ForbiddenException} 当用户权限不足时
   * @throws {InternalServerErrorException} 当备份过程发生错误时
   */
  @Post()
  @Perm('backup', ['create'])
  @ApiOperation({ summary: 'Create a database backup' })
  @HttpCode(HttpStatus.CREATED)
  @ApiResponse({ status: 201, description: 'Backup created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async createBackup(@Body() raw: unknown): Promise<z.infer<typeof BackupInfoSchema>> {
    const createBackupDto = CreateBackupSchema.parse(raw);
    return this.backupService.createBackup(createBackupDto);
  }

  /**
   * 获取备份列表
   *
   * 获取系统中所有可用的备份文件列表，支持分页和排序。
   * 返回备份文件的详细信息，包括文件名、大小、创建时间等。
   *
   * @param getBackupsDto 查询参数，包括分页和排序选项
   * @returns 备份文件列表和分页信息
   * @throws {UnauthorizedException} 当用户未认证时
   * @throws {ForbiddenException} 当用户权限不足时
   */
  @Get()
  @Perm('backup', ['read'])
  @ApiOperation({ summary: 'List all backups' })
  @ApiResponse({ status: 200, description: 'Backups retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getBackups(@Query() raw: unknown): Promise<z.infer<typeof BackupListSchema>> {
    const getBackupsDto = GetBackupsSchema.parse(raw);
    return this.backupService.getBackups(getBackupsDto);
  }

  /**
   * 下载备份文件
   *
   * 根据文件名下载指定的备份文件。文件将以流的形式返回，
   * 支持大文件的高效传输。
   *
   * @param filename 备份文件名
   * @param res Express响应对象
   * @returns 可流式传输的文件对象
   * @throws {NotFoundException} 当备份文件不存在时
   * @throws {UnauthorizedException} 当用户未认证时
   * @throws {ForbiddenException} 当用户权限不足时
   */
  @Get(':filename/download')
  @Perm('backup', ['download'])
  @ApiOperation({ summary: 'Download a backup by filename' })
  @ApiResponse({ status: 200, description: 'Backup file downloaded successfully' })
  @ApiResponse({ status: 404, description: 'Backup file not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  downloadBackup(
    @Param('filename') filename: string,
    @Res({ passthrough: true }) res: Response,
  ): StreamableFile {
    // 验证文件名安全性（防止路径遍历攻击）
    if (!filename.endsWith('.vbak') || filename.includes('..') || filename.includes('/')) {
      throw new Error('Invalid filename');
    }

    const backupDir = path.join(process.cwd(), 'data', 'backups');
    const filepath = path.join(backupDir, filename);

    // 验证文件存在
    if (!fs.existsSync(filepath)) {
      throw new Error('Backup file not found');
    }

    const file = fs.createReadStream(filepath);
    const stats = fs.statSync(filepath);

    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': stats.size,
    });

    return new StreamableFile(file);
  }

  /**
   * 删除备份文件
   *
   * 根据文件名删除指定的备份文件。删除操作不可逆，
   * 请确保不再需要该备份文件。
   *
   * @param filename 要删除的备份文件名
   * @throws {NotFoundException} 当备份文件不存在时
   * @throws {UnauthorizedException} 当用户未认证时
   * @throws {ForbiddenException} 当用户权限不足时
   */
  @Delete(':filename')
  @Perm('backup', ['delete'])
  @ApiOperation({ summary: 'Delete a backup file by filename' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiResponse({ status: 204, description: 'Backup deleted successfully' })
  @ApiResponse({ status: 404, description: 'Backup file not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async deleteBackup(@Param('filename') filename: string): Promise<void> {
    // 验证文件名安全性
    if (!filename.endsWith('.vbak') || filename.includes('..') || filename.includes('/')) {
      throw new Error('Invalid filename');
    }

    return this.backupService.deleteBackup(filename);
  }

  /**
   * 从备份文件恢复数据库
   *
   * 使用指定的备份文件恢复数据库。恢复操作是异步的，
   * 会返回一个任务ID用于跟踪恢复进度。
   *
   * @param filename 备份文件名
   * @param restoreBackupDto 恢复配置参数
   * @returns 包含任务ID的对象，用于跟踪恢复进度
   * @throws {NotFoundException} 当备份文件不存在时
   * @throws {BadRequestException} 当恢复参数无效时
   * @throws {UnauthorizedException} 当用户未认证时
   * @throws {ForbiddenException} 当用户权限不足时
   */
  @Post(':filename/restore')
  @HttpCode(HttpStatus.ACCEPTED)
  @Perm('backup', ['restore'])
  @ApiOperation({ summary: 'Restore database from a backup file' })
  @ApiResponse({
    status: 202,
    description: 'Restore task started',
    schema: { properties: { taskId: { type: 'string' } } },
  })
  @ApiResponse({ status: 404, description: 'Backup file not found' })
  @ApiResponse({ status: 400, description: 'Invalid request parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async restoreBackup(
    @Param('filename') filename: string,
    @Body() raw: unknown,
  ): Promise<{ taskId: string }> {
    // 验证文件名安全性
    if (!filename.endsWith('.vbak') || filename.includes('..') || filename.includes('/')) {
      throw new Error('Invalid filename');
    }

    const restoreBackupDto = RestoreBackupSchema.parse(raw);
    return this.backupService.restoreBackup(filename, restoreBackupDto);
  }

  /**
   * 获取恢复任务进度
   *
   * 根据任务ID查询数据库恢复任务的当前进度和状态。
   * 可用于实时监控恢复操作的执行情况。
   *
   * @param taskId 恢复任务ID
   * @returns 恢复任务的进度信息
   * @throws {NotFoundException} 当恢复任务不存在时
   * @throws {UnauthorizedException} 当用户未认证时
   * @throws {ForbiddenException} 当用户权限不足时
   */
  @Get('restore/:taskId/progress')
  @Perm('backup', ['restore'])
  @ApiOperation({ summary: 'Get restore task progress' })
  @ApiResponse({
    status: 200,
    description: 'Restore progress retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Restore task not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  getRestoreProgress(@Param('taskId') taskId: string): z.infer<typeof RestoreProgressSchema> {
    return this.backupService.getRestoreProgress(taskId);
  }

  /**
   * 导出数据库备份
   *
   * 生成并导出当前数据库的备份文件。
   *
   * @returns 备份文件buffer
   */
  @Get('export')
  @Perm('backup', ['read'])
  @ApiOperation({ summary: 'Export database backup' })
  @ApiResponse({ status: 200, description: 'Backup exported successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async exportBackup() {
    return this.backupService.exportBackup();
  }

  // ts-rest handlers for contract compatibility

  @TsRestHandler(contract.importBackup)
  @Perm('backup', ['restore'])
  @UseInterceptors(FileInterceptor('file'))
  importBackup_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.importBackup, async ({ rawRequest }) => {
      const req = rawRequest as { file?: Express.Multer.File };
      if (!req.file) {
        throw new Error('No file uploaded');
      }
      await this.backupService.importBackup(req.file);
      return { status: 201, body: { success: true } };
    });
  }

  @TsRestHandler(contract.exportBackup)
  @Perm('backup', ['read'])
  exportBackup_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.exportBackup, async () => {
      const buffer = await this.backupService.exportBackup();
      return {
        status: 200,
        body: buffer as unknown as { toString: () => string },
      } as { status: 200; body: unknown };
    });
  }

  @TsRestHandler(contract.restoreBackup)
  @Perm('backup', ['restore'])
  restoreBackup_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.restoreBackup, async ({ body }) => {
      await this.backupService.restoreFromBackup(body);
      return { status: 200, body: { success: true } };
    });
  }
}
