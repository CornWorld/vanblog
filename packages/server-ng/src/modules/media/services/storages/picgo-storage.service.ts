import { createHash } from 'crypto';
import { promises as fsPromises } from 'fs';
import { join } from 'path';

import { Injectable, Logger } from '@nestjs/common';
import { nowIsoTz } from '@vanblog/shared/runtime';
import { PicGo } from 'picgo';

import { StorageService, UploadResult } from '../../interfaces/storage.interface';

import type { PicGoPluginLogEntry } from '../../dto/picgo-plugin.dto';

/**
 * PicGo 存储服务 - 基于 PicGo 的图床上传
 *
 * @note Special case: Uses ISO 8601 timestamps (nowIsoTz()) for in-memory logs
 * @reason Performance optimization for ephemeral data:
 *   - In-memory circular buffer (not persisted to database)
 *   - Short-lived data (200 entries max)
 *   - Used for debugging/monitoring only
 *   - ISO 8601 format consistent with project standards
 *   - Temporary file naming still uses numeric timestamps (line 86)
 */

@Injectable()
export class PicgoStorageService implements StorageService {
  private readonly picgo: PicGo;
  private readonly logger = new Logger(PicgoStorageService.name);
  private readonly tmpDir = join(process.cwd(), 'tmp');
  // 简单的内存环形日志，避免复杂度
  private readonly maxLogs = 200;
  private readonly logs: PicGoPluginLogEntry[] = [];

  constructor() {
    this.picgo = new PicGo();
  }

  configure(config: Record<string, unknown>): void {
    this.picgo.setConfig(config);
  }

  // 记录日志（追加至环形缓冲）
  private recordPluginLog(entry: PicGoPluginLogEntry): void {
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.splice(0, this.logs.length - this.maxLogs);
    }
  }

  getPluginLogs(): { logs: PicGoPluginLogEntry[]; total: number } {
    return { logs: [...this.logs], total: this.logs.length };
  }

  async installPlugins(plugins: string[]): Promise<void> {
    if (plugins.length > 0) {
      this.logger.log(`Installing PicGo plugins: ${plugins.join(', ')}`);
      this.recordPluginLog({
        timestamp: nowIsoTz(),
        level: 'info',
        message: `Installing: ${plugins.join(', ')}`,
      });
      try {
        const result = await this.picgo.pluginHandler.install(plugins);
        if (result.success) {
          const msg = `PicGo plugins installed successfully: ${String(result.body)}`;
          this.logger.log(msg);
          this.recordPluginLog({ timestamp: nowIsoTz(), level: 'info', message: msg });
        } else {
          const msg = `Failed to install PicGo plugins: ${String(result.body)}`;
          this.logger.error(msg);
          this.recordPluginLog({ timestamp: nowIsoTz(), level: 'error', message: msg });
        }
      } catch (error: unknown) {
        const msg = `Error installing PicGo plugins: ${String(error)}`;
        this.logger.error(msg);
        this.recordPluginLog({ timestamp: nowIsoTz(), level: 'error', message: msg });
      }
    }
  }

  async upload(file: Express.Multer.File, filename: string): Promise<UploadResult> {
    await fsPromises.mkdir(this.tmpDir, { recursive: true });

    const timestamp = Date.now();
    const hash = createHash('md5').update(file.buffer).digest('hex').substring(0, 8);
    const ext = filename.split('.').pop();
    const tmpFilename = `${String(timestamp)}-${hash}.${ext ?? ''}`;
    const tmpFilePath = join(this.tmpDir, tmpFilename);

    try {
      await fsPromises.writeFile(tmpFilePath, file.buffer);

      const results = await this.picgo.upload([tmpFilePath]);

      if (!Array.isArray(results) || results.length === 0) {
        throw new Error('PicGo upload failed: no results returned');
      }

      const result = results[0] as { imgUrl?: string; url?: string; fileName?: string };
      const okMsg = `PicGo uploaded file: ${result.fileName ?? filename} -> ${result.imgUrl ?? result.url ?? ''}`;
      this.recordPluginLog({ timestamp: nowIsoTz(), level: 'info', message: okMsg });
      return {
        url: result.imgUrl ?? result.url ?? '',
        filename: result.fileName ?? filename,
        size: file.buffer.length,
        mimeType: file.mimetype,
      };
    } catch (error: unknown) {
      const errMsg = `PicGo upload failed: ${error instanceof Error ? error.message : String(error)}`;
      this.recordPluginLog({ timestamp: nowIsoTz(), level: 'error', message: errMsg });
      throw new Error(errMsg);
    } finally {
      try {
        await fsPromises.unlink(tmpFilePath);
      } catch {
        const warnMsg = `Failed to delete temporary file: ${tmpFilePath}`;
        this.logger.warn(warnMsg);
        this.recordPluginLog({ timestamp: nowIsoTz(), level: 'warn', message: warnMsg });
      }
    }
  }

  async delete(filename: string): Promise<boolean> {
    // PicGo 不支持删除操作
    const warnMsg = `Delete operation not supported by PicGo for file: ${filename}`;
    this.logger.warn(warnMsg);
    this.recordPluginLog({ timestamp: nowIsoTz(), level: 'warn', message: warnMsg });
    return Promise.resolve(false);
  }

  getUrl(filename: string): string {
    // URL 由 PicGo 上传后返回，这里只是占位
    return filename;
  }
}
