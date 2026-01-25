import { promises as fsPromises } from 'fs';
import { join } from 'path';

import { Injectable } from '@nestjs/common';

import { StorageService, UploadResult } from '../../interfaces/storage.interface';

@Injectable()
export class LocalStorageService implements StorageService {
  private readonly uploadDir = join(process.cwd(), 'uploads', 'images');

  async upload(file: Express.Multer.File, filename: string): Promise<UploadResult> {
    await fsPromises.mkdir(this.uploadDir, { recursive: true });

    const filePath = join(this.uploadDir, filename);
    await fsPromises.writeFile(filePath, file.buffer);

    return {
      url: this.getUrl(filename),
      filename,
      size: file.buffer.length,
      mimeType: file.mimetype,
    };
  }

  async delete(filename: string): Promise<boolean> {
    try {
      const filePath = join(this.uploadDir, filename);
      await fsPromises.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  getUrl(filename: string): string {
    return `/uploads/images/${filename}`;
  }
}
