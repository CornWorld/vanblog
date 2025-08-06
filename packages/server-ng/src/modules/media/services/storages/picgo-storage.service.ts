import { createHash } from 'crypto';
import { promises as fsPromises } from 'fs';
import { join } from 'path';

import { Injectable, Logger } from '@nestjs/common';
import { PicGo } from 'picgo';

import { StorageService, UploadResult } from '../../interfaces/storage.interface';

@Injectable()
export class PicgoStorageService implements StorageService {
  private readonly picgo: PicGo;
  private readonly logger = new Logger(PicgoStorageService.name);
  private readonly tmpDir = join(process.cwd(), 'tmp');

  constructor() {
    this.picgo = new PicGo();
  }

  configure(config: Record<string, unknown>): void {
    this.picgo.setConfig(config);
  }

  async installPlugins(plugins: string[]): Promise<void> {
    if (plugins.length > 0) {
      this.logger.log(`Installing PicGo plugins: ${plugins.join(', ')}`);
      try {
        const result = await this.picgo.pluginHandler.install(plugins);
        if (result.success) {
          this.logger.log(`PicGo plugins installed successfully: ${String(result.body)}`);
        } else {
          this.logger.error(`Failed to install PicGo plugins: ${String(result.body)}`);
        }
      } catch (error) {
        this.logger.error(`Error installing PicGo plugins: ${String(error)}`);
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
      return {
        url: result.imgUrl ?? result.url ?? '',
        filename: result.fileName ?? filename,
        size: file.buffer.length,
        mimeType: file.mimetype,
      };
    } catch (error) {
      throw new Error(
        `PicGo upload failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      try {
        await fsPromises.unlink(tmpFilePath);
      } catch {
        this.logger.warn(`Failed to delete temporary file: ${tmpFilePath}`);
      }
    }
  }

  delete(filename: string): Promise<boolean> {
    // PicGo 不支持删除操作
    this.logger.warn(`Delete operation not supported by PicGo for file: ${filename}`);
    return Promise.resolve(false);
  }

  getUrl(filename: string): string {
    // URL 由 PicGo 上传后返回，这里只是占位
    return filename;
  }
}
