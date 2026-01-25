import { Injectable, Inject } from '@nestjs/common';
import { customPages } from '@vanblog/shared/drizzle';
import { eq } from 'drizzle-orm';

import { DATABASE_CONNECTION, type Database } from '../../database';
import { MarkdownService } from '../../shared/services/markdown.service';

interface CustomPageList {
  name: string;
  path: string;
}

interface CustomPage extends CustomPageList {
  html: string;
}

@Injectable()
export class CustomPageService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly markdownService: MarkdownService,
  ) {}

  async getAllCustomPages(): Promise<CustomPageList[]> {
    const pages = await this.db
      .select({
        name: customPages.title,
        path: customPages.pathname,
      })
      .from(customPages);

    return pages;
  }

  async getCustomPageByPath(path: string): Promise<CustomPage | null> {
    const pageResult = await this.db
      .select({
        title: customPages.title,
        pathname: customPages.pathname,
        content: customPages.content,
        type: customPages.type,
      })
      .from(customPages)
      .where(eq(customPages.pathname, path))
      .limit(1);

    if (pageResult.length === 0) {
      return null;
    }

    const [page] = pageResult;
    const html =
      page.type === 'markdown' ? this.markdownService.renderMarkdown(page.content) : page.content;

    return {
      name: page.title,
      path: page.pathname,
      html,
    };
  }
}
