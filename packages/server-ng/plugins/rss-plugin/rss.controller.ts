import * as fs from 'fs/promises';
import * as path from 'path';

import type { RssService } from './rss.service';
import type { Request, Response } from 'express';

export class RssController {
  constructor(private readonly rssService: RssService) {}

  /**
   * GET /rss/feed.xml - RSS 2.0 格式
   */
  async getRssFeed(_req: Request, res: Response): Promise<void> {
    try {
      const staticPath = process.env.STATIC_PATH ?? './static';
      const filePath = path.join(staticPath, 'rss', 'feed.xml');

      const content = await fs.readFile(filePath, 'utf-8');

      res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 缓存 1 小时
      res.send(content);
    } catch {
      // 如果文件不存在，触发重新生成
      void this.rssService.generateRssFeedFn('RSS 文件不存在');

      res.status(503).json({
        error: 'RSS feed is being generated, please try again later',
      });
    }
  }

  /**
   * GET /rss/feed.json - JSON Feed 格式
   */
  async getJsonFeed(_req: Request, res: Response): Promise<void> {
    try {
      const staticPath = process.env.STATIC_PATH ?? './static';
      const filePath = path.join(staticPath, 'rss', 'feed.json');

      const content = await fs.readFile(filePath, 'utf-8');

      res.setHeader('Content-Type', 'application/feed+json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 缓存 1 小时
      res.send(content);
    } catch {
      // 如果文件不存在，触发重新生成
      void this.rssService.generateRssFeedFn('JSON Feed 文件不存在');

      res.status(503).json({
        error: 'JSON feed is being generated, please try again later',
      });
    }
  }

  /**
   * GET /rss/atom.xml - Atom 1.0 格式
   */
  async getAtomFeed(_req: Request, res: Response): Promise<void> {
    try {
      const staticPath = process.env.STATIC_PATH ?? './static';
      const filePath = path.join(staticPath, 'rss', 'atom.xml');

      const content = await fs.readFile(filePath, 'utf-8');

      res.setHeader('Content-Type', 'application/atom+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 缓存 1 小时
      res.send(content);
    } catch {
      // 如果文件不存在，触发重新生成
      void this.rssService.generateRssFeedFn('Atom Feed 文件不存在');

      res.status(503).json({
        error: 'Atom feed is being generated, please try again later',
      });
    }
  }

  /**
   * POST /api/v2/admin/rss/regenerate - 手动触发 RSS 重新生成（管理员）
   */
  async regenerateFeed(_req: Request, res: Response): Promise<void> {
    try {
      // 立即触发重新生成
      await this.rssService.generateRssFeedFn('手动触发');

      res.json({
        success: true,
        message: 'RSS feed regeneration completed',
        lastGenerated: this.rssService.getLastGeneratedTime(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to regenerate RSS feed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
