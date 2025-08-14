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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';

import { RequireAuth } from '../auth/auth.decorator';

import { BackupService } from './backup.service';
import {
  CreateBackupDto,
  RestoreBackupDto,
  GetBackupsDto,
  BackupInfoDto,
  BackupListDto,
  RestoreProgressDto,
  CreateBackupSchema,
  RestoreBackupSchema,
} from './dto/backup.dto';

import type { Response } from 'express';

@ApiTags('backup')
@Controller({ path: 'backup', version: '2' })
@ApiBearerAuth()
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireAuth('backup:create')
  @ApiOperation({ summary: 'Create a new backup' })
  @ApiResponse({ status: 201, description: 'Backup created successfully', type: BackupInfoDto })
  @ApiResponse({ status: 400, description: 'Invalid request parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async createBackup(
    @Body(new ZodValidationPipe(CreateBackupSchema)) createBackupDto: CreateBackupDto,
  ): Promise<BackupInfoDto> {
    return this.backupService.createBackup(createBackupDto);
  }

  @Get()
  @RequireAuth('backup:read')
  @ApiOperation({ summary: 'Get list of backups' })
  @ApiResponse({ status: 200, description: 'Backups retrieved successfully', type: BackupListDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getBackups(@Query() getBackupsDto: GetBackupsDto): Promise<BackupListDto> {
    return this.backupService.getBackups(getBackupsDto);
  }

  @Get(':filename/download')
  @RequireAuth('backup:download')
  @ApiOperation({ summary: 'Download a backup file' })
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

  @Delete(':filename')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireAuth('backup:delete')
  @ApiOperation({ summary: 'Delete a backup file' })
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

  @Post(':filename/restore')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireAuth('backup:restore')
  @ApiOperation({ summary: 'Restore from a backup file' })
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
    @Body(new ZodValidationPipe(RestoreBackupSchema)) restoreBackupDto: RestoreBackupDto,
  ): Promise<{ taskId: string }> {
    // 验证文件名安全性
    if (!filename.endsWith('.vbak') || filename.includes('..') || filename.includes('/')) {
      throw new Error('Invalid filename');
    }

    return this.backupService.restoreBackup(filename, restoreBackupDto);
  }

  @Get('restore/:taskId/progress')
  @RequireAuth('backup:restore')
  @ApiOperation({ summary: 'Get restore task progress' })
  @ApiResponse({
    status: 200,
    description: 'Restore progress retrieved successfully',
    type: RestoreProgressDto,
  })
  @ApiResponse({ status: 404, description: 'Restore task not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  getRestoreProgress(@Param('taskId') taskId: string): RestoreProgressDto {
    return this.backupService.getRestoreProgress(taskId);
  }
}
