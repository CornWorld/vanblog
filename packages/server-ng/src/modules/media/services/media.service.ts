import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, like, and, desc, sql, inArray } from 'drizzle-orm';
import { LibSQLDatabase } from 'drizzle-orm/libsql';
import sharp from 'sharp';

import { DATABASE_CONNECTION } from '../../../database/database.module';
import { staticFiles } from '../../../database/schema';
import { HookService } from '../../plugin/services/hook.service';
import { ListStaticFilesDto } from '../dto/list-static-files.dto';
import { StorageProvider } from '../dto/storage-config.dto';

import { StorageFactoryService } from './storage-factory.service';

@Injectable()
export class MediaService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    public readonly db: LibSQLDatabase,
    private readonly storageFactoryService: StorageFactoryService,
    private readonly hookService: HookService,
  ) {}

  async uploadFile(
    file: Express.Multer.File,
    customFilename?: string,
    provider = 'local',
  ): Promise<typeof staticFiles.$inferSelect> {
    // Apply beforeUpload filter
    const filteredData = await this.hookService.applyFilters('media|beforeUpload', {
      file,
      customFilename,
      provider,
    });

    const filename = filteredData.customFilename ?? file.originalname;
    const storageService = await this.storageFactoryService.getStorageService();

    const { filename: uploadedFilename, url } = await storageService.upload(file, filename);

    // 获取图像尺寸信息
    let width: number | undefined;
    let height: number | undefined;

    if (file.mimetype.startsWith('image/')) {
      try {
        const metadata = await sharp(file.buffer).metadata();
        ({ width, height } = metadata);
      } catch {
        // Error reading image metadata
      }
    }

    const [result] = await this.db
      .insert(staticFiles)
      .values({
        filename: uploadedFilename,
        path: url,
        size: file.size,
        mimeType: file.mimetype,
        width,
        height,
        hash: '', // Hash not required anymore
        provider,
      })
      .returning();

    // Execute afterUpload action
    await this.hookService.doAction('media|afterUpload', {
      file: result,
      originalFile: file,
    });

    return result;
  }

  async listFiles(query: ListStaticFilesDto): Promise<{
    items: (typeof staticFiles.$inferSelect)[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const { keyword, type: mimeType, page = 1, pageSize = 20 } = query;
    const offset = (Number(page) - 1) * Number(pageSize);

    const conditions = [];
    if (keyword) {
      conditions.push(like(staticFiles.filename, `%${String(keyword)}%`));
    }
    conditions.push(eq(staticFiles.mimeType, String(mimeType)));

    // Provider filtering removed as it's not part of the current DTO

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, countResult] = await Promise.all([
      whereClause
        ? this.db
            .select()
            .from(staticFiles)
            .where(whereClause)
            .orderBy(desc(staticFiles.createdAt))
            .limit(Number(pageSize))
            .offset(offset)
        : this.db
            .select()
            .from(staticFiles)
            .orderBy(desc(staticFiles.createdAt))
            .limit(Number(pageSize))
            .offset(offset),
      whereClause
        ? this.db
            .select({ count: sql<number>`count(*)` })
            .from(staticFiles)
            .where(whereClause)
        : this.db.select({ count: sql<number>`count(*)` }).from(staticFiles),
    ]);

    const total = countResult[0]?.count ?? 0;

    return {
      items,
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / Number(pageSize)),
    };
  }

  async getFileById(id: number): Promise<typeof staticFiles.$inferSelect> {
    const result = await this.db.select().from(staticFiles).where(eq(staticFiles.id, id)).limit(1);

    if (result.length === 0) {
      throw new NotFoundException(`File with ID ${String(id)} not found`);
    }

    return result[0];
  }

  async deleteFile(id: number): Promise<{ success: boolean; message: string }> {
    const file = await this.getFileById(id);

    // Execute beforeDelete action
    await this.hookService.doAction('media|beforeDelete', { file });

    const storageService = await this.storageFactoryService.getStorageService();
    const currentProvider = await this.storageFactoryService.getCurrentProvider();

    if (currentProvider === StorageProvider.LOCAL || file.provider === StorageProvider.LOCAL) {
      try {
        await storageService.delete(file.filename);
      } catch {
        // Log error but don't fail the deletion from database
        // TODO: Replace with proper logger
      }
    }

    await this.db.delete(staticFiles).where(eq(staticFiles.id, id));

    const result = { success: true, message: 'File deleted successfully' };

    // Execute afterDelete action
    await this.hookService.doAction('media|afterDelete', { file, result });

    return result;
  }

  async deleteFiles(
    ids: number[],
  ): Promise<{ success: boolean; deletedCount: number; message: string }> {
    if (ids.length === 0) {
      throw new BadRequestException('No file IDs provided');
    }

    const files = await this.db.select().from(staticFiles).where(inArray(staticFiles.id, ids));

    // Execute beforeDeleteBatch action
    await this.hookService.doAction('media|beforeDeleteBatch', { files, ids });

    const storageService = await this.storageFactoryService.getStorageService();
    const currentProvider = await this.storageFactoryService.getCurrentProvider();

    for (const file of files) {
      if (currentProvider === StorageProvider.LOCAL || file.provider === StorageProvider.LOCAL) {
        try {
          await storageService.delete(file.filename);
        } catch {
          // Log error but don't fail the deletion from database
          // TODO: Replace with proper logger
        }
      }
    }

    await this.db.delete(staticFiles).where(inArray(staticFiles.id, ids));

    const result = {
      success: true,
      deletedCount: files.length,
      message: `${String(files.length)} files deleted successfully`,
    };

    // Execute afterDeleteBatch action
    await this.hookService.doAction('media|afterDeleteBatch', { files, result });

    return result;
  }

  async scanArticleImages(): Promise<{ scanned: number; added: number }> {
    // TODO: Implement scanning articles for images
    return Promise.resolve({ scanned: 0, added: 0 });
  }

  async exportAllImages(): Promise<{
    total: number;
    files: Array<{
      id: number;
      filename: string;
      path: string;
      size: number;
      mimeType: string | null;
      createdAt: string | null;
    }>;
  }> {
    const allFiles = await this.db.select().from(staticFiles);

    return {
      total: allFiles.length,
      files: allFiles.map((file) => ({
        id: file.id,
        filename: file.filename,
        path: file.path,
        size: file.size,
        mimeType: file.mimeType,
        createdAt: file.createdAt,
      })),
    };
  }
}
