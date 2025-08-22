import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { and, asc, desc, eq, like, sql, type SQL, inArray } from 'drizzle-orm';
import sharp from 'sharp';

import { LoggerService } from '../../../core/logger/logger.service';
import { DATABASE_CONNECTION, type Database } from '../../../database';
import { staticFiles, articles } from '../../../database/schema';
import { HookService } from '../../plugin/services/hook.service';
import { ListStaticFilesDto } from '../dto/list-static-files.dto';
import { StorageProvider } from '../dto/storage-config.dto';

import { StorageFactoryService } from './storage-factory.service';

@Injectable()
export class MediaService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    public readonly db: Database,
    private readonly storageFactoryService: StorageFactoryService,
    private readonly hookService: HookService,
    private readonly logger: LoggerService,
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

    const widthOrNull: number | null = typeof width === 'number' ? width : null;
    const heightOrNull: number | null = typeof height === 'number' ? height : null;

    const [result] = await this.db
      .insert(staticFiles)
      .values({
        filename: uploadedFilename,
        path: url,
        size: file.size,
        mimeType: file.mimetype,
        width: widthOrNull,
        height: heightOrNull,
        provider: (filteredData as { provider?: string }).provider ?? provider,
      })
      .returning();

    // Execute afterUpload action
    await this.hookService.doAction('media|afterUpload', { file: result });

    // Trigger webhook event
    await this.hookService.doAction('media.uploaded', {
      id: result.id,
      filename: result.filename,
      path: result.path,
      size: result.size,
      mimeType: result.mimeType,
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
    const { page, pageSize, sortBy, sortOrder } = query;
    const offset = (page - 1) * pageSize;

    const clauses: SQL[] = [];

    if (typeof query.keyword === 'string' && query.keyword.length > 0) {
      clauses.push(like(staticFiles.filename, `%${String(query.keyword)}%`));
    }

    if (typeof query.type === 'string') {
      switch (query.type) {
        case 'image':
          clauses.push(like(staticFiles.mimeType, 'image/%'));
          break;
        case 'video':
          clauses.push(like(staticFiles.mimeType, 'video/%'));
          break;
        case 'audio':
          clauses.push(like(staticFiles.mimeType, 'audio/%'));
          break;
        case 'document':
          // application/* but exclude generic octet-stream
          clauses.push(sql`mime_type LIKE 'application/%'`);
          clauses.push(sql`mime_type NOT LIKE 'application/octet-stream'`);
          break;
        case 'other':
          clauses.push(
            sql`mime_type NOT LIKE 'image/%' AND mime_type NOT LIKE 'video/%' AND mime_type NOT LIKE 'audio/%'`,
          );
          break;
        default:
          break;
      }
    }

    let orderExpr: SQL;
    switch (sortBy) {
      case 'name':
        orderExpr = sortOrder === 'asc' ? asc(staticFiles.filename) : desc(staticFiles.filename);
        break;
      case 'size':
        orderExpr = sortOrder === 'asc' ? asc(staticFiles.size) : desc(staticFiles.size);
        break;
      case 'createdAt':
      default:
        orderExpr = sortOrder === 'asc' ? asc(staticFiles.createdAt) : desc(staticFiles.createdAt);
        break;
    }

    let items: (typeof staticFiles.$inferSelect)[];
    if (clauses.length > 0) {
      const wc: SQL = clauses.length === 1 ? clauses[0] : (and(...clauses) as SQL);
      items = await this.db
        .select()
        .from(staticFiles)
        .where(wc)
        .orderBy(orderExpr)
        .limit(pageSize)
        .offset(offset);
    } else {
      items = await this.db
        .select()
        .from(staticFiles)
        .orderBy(orderExpr)
        .limit(pageSize)
        .offset(offset);
    }

    let countRow: { count: number } | undefined;
    if (clauses.length > 0) {
      const wc: SQL = clauses.length === 1 ? clauses[0] : (and(...clauses) as SQL);
      countRow = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(staticFiles)
        .where(wc)
        .get();
    } else {
      countRow = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(staticFiles)
        .get();
    }

    const total = countRow ? Number(countRow.count) : 0;
    const totalPages = Math.ceil(total / pageSize);

    return { items, total, page, pageSize, totalPages };
  }

  async getFileById(id: number): Promise<typeof staticFiles.$inferSelect> {
    const file = await this.db.select().from(staticFiles).where(eq(staticFiles.id, id)).get();
    if (!file) {
      throw new NotFoundException(`File with ID ${id} not found`);
    }
    return file;
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
      } catch (err) {
        // Log error but don't fail the deletion from database
        this.logger.error(
          `Failed to delete file from storage: ${file.filename}`,
          err instanceof Error ? err.stack : undefined,
          MediaService.name,
        );
      }
    }

    await this.db.delete(staticFiles).where(eq(staticFiles.id, id));

    const result = { success: true, message: 'File deleted successfully' };

    // Execute afterDelete action
    await this.hookService.doAction('media|afterDelete', { file, result });

    // Trigger webhook event
    await this.hookService.doAction('media.deleted', {
      id: file.id,
      filename: file.filename,
      path: file.path,
      size: file.size,
      mimeType: file.mimeType,
    });

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
        } catch (err) {
          // Log error but don't fail the deletion from database
          this.logger.error(
            `Failed to delete file from storage: ${file.filename}`,
            err instanceof Error ? err.stack : undefined,
            MediaService.name,
          );
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

    // Trigger webhook event
    await this.hookService.doAction('media.batch_deleted', {
      deletedCount: files.length,
      files: files.map((file) => ({
        id: file.id,
        filename: file.filename,
        path: file.path,
        size: file.size,
        mimeType: file.mimeType,
      })),
    });

    return result;
  }

  async scanArticleImages(): Promise<{ scanned: number; added: number }> {
    // 1) 扫描所有文章内容，提取图片 URL（Markdown、HTML、url(...)）
    const rows = await this.db
      .select({ id: articles.id, content: articles.content })
      .from(articles);

    const urlSet = new Set<string>();
    for (const row of rows) {
      const urls = this.extractImageUrls(row.content);
      for (const u of urls) urlSet.add(u);
    }

    // 无可用 URL
    if (urlSet.size === 0) {
      this.logger.info('scanArticleImages: no image urls found', MediaService.name);
      return { scanned: 0, added: 0 };
    }

    const allUrls = Array.from(urlSet);

    // 2) 查询已存在的路径，避免重复插入
    let existingPaths: Array<{ path: string }> = [];
    if (allUrls.length > 0) {
      // 分批以避免 SQL 占位符过多（保守起见，按 500 一批）
      const batchSize = 500;
      for (let i = 0; i < allUrls.length; i += batchSize) {
        const slice = allUrls.slice(i, i + batchSize);
        // inArray 要求非空数组
        const part = await this.db
          .select({ path: staticFiles.path })
          .from(staticFiles)
          .where(inArray(staticFiles.path, slice));
        existingPaths = existingPaths.concat(part);
      }
    }

    const existingSet = new Set(existingPaths.map((r) => r.path));
    const missing = allUrls.filter((u) => !existingSet.has(u));

    if (missing.length > 0) {
      const values = missing.map((url) => ({
        filename: this.filenameFromUrl(url),
        path: url,
        size: 0, // 大小未知，用 0 占位
        mimeType: this.guessMimeTypeFromUrl(url),
      }));

      // 插入缺失的条目
      await this.db.insert(staticFiles).values(values).returning();
    }

    const scanned = urlSet.size;
    const added = missing.length;

    this.logger.info(
      `scanArticleImages: scanned=${String(scanned)}, added=${String(added)}`,
      MediaService.name,
    );

    return { scanned, added };
  }

  private extractImageUrls(content: string): string[] {
    const results = new Set<string>();

    // 跳过 data: URL
    const isAcceptable = (u: string): boolean =>
      (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('/')) &&
      !u.startsWith('data:');

    // 1) Markdown: ![alt](url "title")
    const mdImg = /!\[[^\]]*\]\((\s*<?)([^)\s]+)(?:\s+"[^"]*")?\s*\)/g; // capture group 2 = url
    let match: RegExpExecArray | null;
    while ((match = mdImg.exec(content)) !== null) {
      const [, , url] = match;
      if (url.length > 0 && isAcceptable(url) && this.isImageLike(url)) {
        results.add(this.normalizeUrl(url));
      }
    }

    // 2) HTML: <img src="...">
    const htmlImg = /<img[^>]+src=["']([^"']+)["']/gi;
    while ((match = htmlImg.exec(content)) !== null) {
      const [, url] = match;
      if (url.length > 0 && isAcceptable(url) && this.isImageLike(url)) {
        results.add(this.normalizeUrl(url));
      }
    }

    // 3) url(...) patterns
    const cssUrl = /url\((['"]?)([^'")]+)\1\)/gi;
    while ((match = cssUrl.exec(content)) !== null) {
      const [, , url] = match;
      if (url.length > 0 && isAcceptable(url) && this.isImageLike(url)) {
        results.add(this.normalizeUrl(url));
      }
    }

    return Array.from(results);
  }

  private isImageLike(url: string): boolean {
    const lower = url.split('?')[0]?.toLowerCase() ?? '';
    return (
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.png') ||
      lower.endsWith('.gif') ||
      lower.endsWith('.webp') ||
      lower.endsWith('.svg') ||
      lower.endsWith('.bmp') ||
      lower.endsWith('.tif') ||
      lower.endsWith('.tiff') ||
      lower.endsWith('.ico') ||
      lower.endsWith('.avif')
    );
  }

  private normalizeUrl(url: string): string {
    // 去掉可能的包裹尖括号，并保留原样（不做 baseUrl 拼接），统一去掉空白
    let u = url.trim();
    if (u.startsWith('<') && u.endsWith('>')) {
      u = u.slice(1, -1);
    }
    return u;
  }

  private filenameFromUrl(url: string): string {
    const noQuery = url.split('?')[0] ?? url;
    const seg = noQuery.split('/').filter(Boolean);
    const name = seg.length > 0 ? seg[seg.length - 1] : 'unknown';
    try {
      return decodeURIComponent(name);
    } catch {
      return name;
    }
  }

  private guessMimeTypeFromUrl(url: string): string | null {
    const lower = url.split('?')[0]?.toLowerCase() ?? '';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.svg')) return 'image/svg+xml';
    if (lower.endsWith('.bmp')) return 'image/bmp';
    if (lower.endsWith('.tif') || lower.endsWith('.tiff')) return 'image/tiff';
    if (lower.endsWith('.ico')) return 'image/x-icon';
    if (lower.endsWith('.avif')) return 'image/avif';
    return null;
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
    const files = await this.db
      .select({
        id: staticFiles.id,
        filename: staticFiles.filename,
        path: staticFiles.path,
        size: staticFiles.size,
        mimeType: staticFiles.mimeType,
        createdAt: staticFiles.createdAt,
      })
      .from(staticFiles)
      .orderBy(desc(staticFiles.createdAt));

    return {
      total: files.length,
      files: files.map((f) => ({
        id: f.id,
        filename: f.filename,
        path: f.path,
        size: f.size,
        mimeType: f.mimeType,
        createdAt: f.createdAt,
      })),
    };
  }
}
