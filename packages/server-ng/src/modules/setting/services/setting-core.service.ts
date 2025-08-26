import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { DATABASE_CONNECTION, type Database } from '../../../database';
import { siteMeta } from '../../../database/schema';
import { safeParseJson, dataSchemas, NavigationNode } from '../../../shared/zod';
import { HookService } from '../../plugin/services/hook.service';

import { SettingRegistryService } from './setting-registry.service';

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
  icon?: string;
  external?: boolean;
  children?: Navigation[];
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
    private readonly db: Database,
    private readonly hookService: HookService,
    private readonly registryService: SettingRegistryService,
  ) {}

  // Generic config methods with optional schema validation
  async getConfig<T>(key: string, defaultValue?: T, schema?: z.ZodType<T>): Promise<T | null> {
    const results = await this.db.select().from(siteMeta).where(eq(siteMeta.key, key)).limit(1);

    if (results.length > 0 && results[0].value) {
      if (schema) {
        const parsed = safeParseJson<T>(results[0].value, schema);
        return parsed;
      }
      const parsed = safeParseJson(results[0].value, dataSchemas.genericObject);
      return parsed as unknown as T | null;
    }

    if (defaultValue !== undefined) {
      // Delegate to registry to persist default via upsert (concurrency-safe)
      await this.registryService.updateConfig(key, defaultValue as T);
      return defaultValue;
    }

    return null;
  }

  async updateConfig<T>(key: string, value: T): Promise<T> {
    // Apply beforeUpdateSetting filter
    const filteredData = await this.hookService.applyFilters('setting|beforeUpdate', {
      key,
      value,
    });

    // Get old value for hooks
    const existing = await this.db.select().from(siteMeta).where(eq(siteMeta.key, key)).limit(1);
    const oldValue = existing.length > 0 ? existing[0].value : null;

    // Delegate write to registry service (single-statement upsert, idempotent)
    await this.registryService.updateConfig(key, filteredData.value);

    // Execute canonical afterUpdate action (include both raw and parsed for compatibility)
    await this.hookService.doAction('setting|afterUpdate', {
      key,
      value: filteredData.value,
      oldValue, // raw string
      parsedOldValue: oldValue ? safeParseJson(oldValue, dataSchemas.genericObject) : null,
      updatedAt: new Date().toISOString(),
    });

    return filteredData.value;
  }

  // Site Info
  async getSiteInfo(): Promise<SiteInfo> {
    const defaultInfo: SiteInfo = {
      title: 'My Blog',
      description: 'A modern blog platform',
      author: 'Admin',
      keywords: ['blog', 'tech', 'personal'],
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

  // Navigation with strict schema validation
  async getNavigation(): Promise<Navigation[]> {
    const defaultNavigation: Navigation[] = [
      { name: 'Home', path: '/' },
      { name: 'Archive', path: '/archive' },
      { name: 'About', path: '/about' },
    ];
    const result = await this.getConfig<NavigationNode[]>(
      'navigation',
      defaultNavigation as unknown as NavigationNode[],
      dataSchemas.navigationArray,
    );
    if (!result) {
      return defaultNavigation;
    }
    return result as unknown as Navigation[];
  }

  async updateNavigation(items: Navigation[]): Promise<Navigation[]> {
    // Validate the incoming data against navigation schema before storage
    const toValidate = items as unknown as NavigationNode[];
    const validationResult = dataSchemas.navigationArray.safeParse(toValidate);
    if (!validationResult.success) {
      throw new Error(`Invalid navigation data: ${validationResult.error.message}`);
    }
    await this.updateConfig('navigation', validationResult.data);
    return items;
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
