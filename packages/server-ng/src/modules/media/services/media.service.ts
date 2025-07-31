import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../database/database.module';
import { LibSQLDatabase } from 'drizzle-orm/libsql';
import { eq, like, and, desc, sql, inArray } from 'drizzle-orm';
import { staticFiles } from '../../../db/schema';
import { ListStaticFilesDto } from '../dto/list-static-files.dto';
import { promises as fsPromises } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import sharp from 'sharp';

@Injectable()
export class MediaService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: LibSQLDatabase,
  ) {}

  async uploadFile(
    file: Express.Multer.File,
    customFilename?: string,
    provider = 'local',
  ): Promise<typeof staticFiles.$inferSelect> {
    const filename = customFilename ?? file.originalname;
    const uploadDir = join(process.cwd(), 'uploads', 'images');

    await fsPromises.mkdir(uploadDir, { recursive: true });

    const timestamp = Date.now();
    const hash = createHash('md5').update(file.buffer).digest('hex');
    const ext = filename.split('.').pop();
    const finalFilename = `${String(timestamp)}-${hash}.${ext ?? ''}`;
    const filePath = join(uploadDir, finalFilename);
    const relativePath = `/uploads/images/${finalFilename}`;

    await fsPromises.writeFile(filePath, file.buffer);

    let width: number | undefined;
    let height: number | undefined;

    try {
      const metadata = await sharp(file.buffer).metadata();
      width = metadata.width;
      height = metadata.height;
    } catch (error) {
      void error;
    }

    const [result] = await this.db
      .insert(staticFiles)
      .values({
        filename: finalFilename,
        path: relativePath,
        size: file.size,
        mimeType: file.mimetype,
        width,
        height,
        hash,
        provider,
      })
      .returning();

    return result;
  }

  async listFiles(query: ListStaticFilesDto): Promise<{
    items: (typeof staticFiles.$inferSelect)[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const { keyword, mimeType, provider, page = 1, pageSize = 20 } = query;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (keyword) {
      conditions.push(like(staticFiles.filename, `%${keyword}%`));
    }
    if (mimeType) {
      conditions.push(eq(staticFiles.mimeType, mimeType));
    }
    if (provider) {
      conditions.push(eq(staticFiles.provider, provider));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, countResult] = await Promise.all([
      this.db
        .select()
        .from(staticFiles)
        .where(whereClause)
        .orderBy(desc(staticFiles.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(staticFiles)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
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

    if (file.provider === 'local') {
      const fullPath = join(process.cwd(), file.path);
      try {
        await fsPromises.unlink(fullPath);
      } catch (error) {
        void error;
      }
    }

    await this.db.delete(staticFiles).where(eq(staticFiles.id, id));

    return { success: true, message: 'File deleted successfully' };
  }

  async deleteFiles(
    ids: number[],
  ): Promise<{ success: boolean; deletedCount: number; message: string }> {
    if (!ids.length) {
      throw new BadRequestException('No file IDs provided');
    }

    const files = await this.db.select().from(staticFiles).where(inArray(staticFiles.id, ids));

    for (const file of files) {
      if (file.provider === 'local') {
        const fullPath = join(process.cwd(), file.path);
        try {
          await fsPromises.unlink(fullPath);
        } catch (error) {
          void error;
        }
      }
    }

    await this.db.delete(staticFiles).where(inArray(staticFiles.id, ids));

    return {
      success: true,
      deletedCount: files.length,
      message: `${String(files.length)} files deleted successfully`,
    };
  }

  scanArticleImages(): Promise<{ scanned: number; added: number }> {
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
      createdAt: Date | null;
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
