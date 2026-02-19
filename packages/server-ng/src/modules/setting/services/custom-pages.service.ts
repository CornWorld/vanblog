import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { customPages } from '@vanblog/shared/drizzle';
import { eq } from 'drizzle-orm';

import { DATABASE_CONNECTION, type Database } from '../../../database';

export interface CustomPageResponse {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class CustomPagesService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  async getAllCustomPages(): Promise<CustomPageResponse[]> {
    const pages = await this.db
      .select({
        id: customPages.id,
        name: customPages.title,
        path: customPages.pathname,
        createdAt: customPages.createdAt,
        updatedAt: customPages.updatedAt,
      })
      .from(customPages);

    return pages.map((page) => ({
      id: String(page.id),
      name: page.name,
      path: page.path,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    }));
  }

  async getCustomPageByPath(pagePath: string): Promise<CustomPageResponse> {
    const pageResult = await this.db
      .select({
        id: customPages.id,
        title: customPages.title,
        pathname: customPages.pathname,
        createdAt: customPages.createdAt,
        updatedAt: customPages.updatedAt,
      })
      .from(customPages)
      .where(eq(customPages.pathname, pagePath))
      .limit(1);

    if (pageResult.length === 0) {
      throw new NotFoundException(`Custom page not found for path: ${pagePath}`);
    }

    const [page] = pageResult;

    return {
      id: String(page.id),
      name: page.title,
      path: page.pathname,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    };
  }

  async createCustomPage(name: string, path: string): Promise<CustomPageResponse> {
    const result = await this.db
      .insert(customPages)
      .values({
        title: name,
        pathname: path,
        content: '',
      })
      .returning({
        id: customPages.id,
        name: customPages.title,
        path: customPages.pathname,
        createdAt: customPages.createdAt,
        updatedAt: customPages.updatedAt,
      });

    const [page] = result;

    return {
      id: String(page.id),
      name: page.name,
      path: page.path,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    };
  }

  async updateCustomPage(
    id: string,
    data: { name?: string; path?: string },
  ): Promise<CustomPageResponse> {
    const updateData: Record<string, string> = {};
    if (data.name !== undefined) {
      updateData['title'] = data.name;
    }
    if (data.path !== undefined) {
      updateData['pathname'] = data.path;
    }

    const result = await this.db
      .update(customPages)
      .set(updateData)
      .where(eq(customPages.id, Number(id)))
      .returning({
        id: customPages.id,
        name: customPages.title,
        path: customPages.pathname,
        createdAt: customPages.createdAt,
        updatedAt: customPages.updatedAt,
      });

    if (result.length === 0) {
      throw new NotFoundException(`Custom page not found for id: ${id}`);
    }

    const [page] = result;

    return {
      id: String(page.id),
      name: page.name,
      path: page.path,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    };
  }

  async deleteCustomPage(pagePath: string): Promise<void> {
    await this.db.delete(customPages).where(eq(customPages.pathname, pagePath));
  }

  async getCustomPageContent(pagePath: string): Promise<string> {
    const pageResult = await this.db
      .select({ content: customPages.content })
      .from(customPages)
      .where(eq(customPages.pathname, pagePath))
      .limit(1);

    if (pageResult.length === 0) {
      throw new NotFoundException(`Custom page not found for path: ${pagePath}`);
    }

    return pageResult[0].content;
  }

  async updateCustomPageContent(pathname: string, content: string): Promise<void> {
    const result = await this.db
      .update(customPages)
      .set({ content })
      .where(eq(customPages.pathname, pathname))
      .returning({ id: customPages.id });

    if (result.length === 0) {
      throw new NotFoundException(`Custom page not found for path: ${pathname}`);
    }
  }
}
