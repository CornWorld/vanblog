import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../database/database.module';
import { LibSQLDatabase } from 'drizzle-orm/libsql';
import { eq, sql } from 'drizzle-orm';
import { siteMeta } from '../../../db/schema';

// Core site configurations that remain in the setting module
export interface SiteInfo {
  title: string;
  description: string;
  author: string;
  keywords: string[];
}

export interface SiteLayout {
  showRecentPosts: boolean;
  recentPostsCount: number;
  showCategories: boolean;
  showTags: boolean;
  showArchive: boolean;
  showAbout: boolean;
  showSearch: boolean;
}

export interface SiteTheme {
  primaryColor: string;
  darkMode: boolean;
}

export interface Navigation {
  name: string;
  path: string;
}

export interface FriendLink {
  name: string;
  url: string;
  description?: string;
  avatar?: string;
}

export interface CustomCode {
  head?: string;
  body?: string;
  footer?: string;
}

@Injectable()
export class SettingCoreService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: LibSQLDatabase,
  ) {}

  // Generic config methods
  async getConfig<T>(key: string, defaultValue?: T): Promise<T | null> {
    const results = await this.db.select().from(siteMeta).where(eq(siteMeta.key, key)).limit(1);

    if (results.length > 0 && results[0].value) {
      return JSON.parse(results[0].value) as T;
    }

    if (defaultValue !== undefined) {
      await this.db.insert(siteMeta).values({
        key,
        value: JSON.stringify(defaultValue),
      });
      return defaultValue;
    }

    return null;
  }

  async updateConfig<T>(key: string, value: T): Promise<T> {
    const existing = await this.db.select().from(siteMeta).where(eq(siteMeta.key, key)).limit(1);

    if (existing.length > 0) {
      await this.db
        .update(siteMeta)
        .set({
          value: JSON.stringify(value),
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(siteMeta.key, key));
    } else {
      await this.db.insert(siteMeta).values({
        key,
        value: JSON.stringify(value),
      });
    }

    return value;
  }

  // Site Info
  async getSiteInfo(): Promise<SiteInfo> {
    const defaultInfo: SiteInfo = {
      title: 'My Blog',
      description: 'A blog powered by VanBlog',
      author: 'Admin',
      keywords: [],
    };
    return (await this.getConfig<SiteInfo>('siteInfo', defaultInfo)) ?? defaultInfo;
  }

  async updateSiteInfo(dto: Partial<SiteInfo>): Promise<SiteInfo> {
    const existing = await this.getSiteInfo();
    const updated = { ...existing, ...dto };
    return this.updateConfig('siteInfo', updated);
  }

  // Layout Settings
  async getLayoutSettings(): Promise<SiteLayout> {
    const defaultLayout: SiteLayout = {
      showRecentPosts: true,
      recentPostsCount: 5,
      showCategories: true,
      showTags: true,
      showArchive: true,
      showAbout: true,
      showSearch: true,
    };
    return (await this.getConfig<SiteLayout>('siteLayout', defaultLayout)) ?? defaultLayout;
  }

  async updateLayoutSettings(dto: Partial<SiteLayout>): Promise<SiteLayout> {
    const existing = await this.getLayoutSettings();
    const updated = { ...existing, ...dto };
    return this.updateConfig('siteLayout', updated);
  }

  // Theme Settings
  async getThemeSettings(): Promise<SiteTheme> {
    const defaultTheme: SiteTheme = {
      primaryColor: '#007BFF',
      darkMode: false,
    };
    return (await this.getConfig<SiteTheme>('siteTheme', defaultTheme)) ?? defaultTheme;
  }

  async updateThemeSettings(dto: Partial<SiteTheme>): Promise<SiteTheme> {
    const existing = await this.getThemeSettings();
    const updated = { ...existing, ...dto };
    return this.updateConfig('siteTheme', updated);
  }

  // Navigation
  async getNavigation(): Promise<Navigation[]> {
    const defaultNavigation: Navigation[] = [
      { name: 'Home', path: '/' },
      { name: 'Archive', path: '/archive' },
      { name: 'About', path: '/about' },
    ];
    return (
      (await this.getConfig<Navigation[]>('navigation', defaultNavigation)) ?? defaultNavigation
    );
  }

  async updateNavigation(items: Navigation[]): Promise<Navigation[]> {
    return this.updateConfig('navigation', items);
  }

  // Friend Links
  async getFriendLinks(): Promise<FriendLink[]> {
    return (await this.getConfig<FriendLink[]>('friendLinks')) ?? [];
  }

  async createFriendLink(dto: FriendLink): Promise<FriendLink[]> {
    const friends = await this.getFriendLinks();
    friends.push(dto);
    return this.updateConfig('friendLinks', friends);
  }

  async updateFriendLink(index: number, dto: Partial<FriendLink>): Promise<FriendLink[]> {
    const friends = await this.getFriendLinks();
    if (index < 0 || index >= friends.length) {
      throw new Error('Invalid index');
    }
    friends[index] = { ...friends[index], ...dto };
    return this.updateConfig('friendLinks', friends);
  }

  async deleteFriendLink(index: number): Promise<FriendLink[]> {
    const friends = await this.getFriendLinks();
    if (index < 0 || index >= friends.length) {
      throw new Error('Invalid index');
    }
    friends.splice(index, 1);
    return this.updateConfig('friendLinks', friends);
  }

  // Custom Code
  async getCustomCode(): Promise<CustomCode> {
    return (await this.getConfig<CustomCode>('customCode')) ?? {};
  }

  async updateCustomCode(dto: Partial<CustomCode>): Promise<CustomCode> {
    const existing = await this.getCustomCode();
    const updated = { ...existing, ...dto };
    return this.updateConfig('customCode', updated);
  }
}
