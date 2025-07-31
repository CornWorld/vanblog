import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../database/database.module';
import { LibSQLDatabase } from 'drizzle-orm/libsql';
import { eq, sql } from 'drizzle-orm';
import { siteMeta } from '../../../db/schema';
import {
  SiteInfo,
  SiteLayout,
  SiteTheme,
  FriendLink,
  Navigation,
  CustomCode,
} from '../entities/site-meta.entity';
import { UpdateSiteInfoDto } from '../dto/update-site-info.dto';
import { UpdateLayoutDto } from '../dto/update-layout.dto';
import { UpdateThemeDto } from '../dto/update-theme.dto';
import { CreateFriendLinkDto, UpdateFriendLinkDto } from '../dto/friend-link.dto';
import { UpdateNavigationDto } from '../dto/navigation.dto';
import { UpdateCustomCodeDto } from '../dto/custom-code.dto';

@Injectable()
export class SettingService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: LibSQLDatabase,
  ) {}

  async getSiteInfo(): Promise<SiteInfo> {
    const results = await this.db
      .select()
      .from(siteMeta)
      .where(eq(siteMeta.key, 'siteInfo'))
      .limit(1);

    if (results.length > 0 && results[0].value) {
      return JSON.parse(results[0].value) as SiteInfo;
    }

    // Return default site info
    const defaultInfo: SiteInfo = {
      title: 'My Blog',
      description: 'A blog powered by VanBlog',
      author: 'Admin',
      keywords: [],
    };

    await this.db.insert(siteMeta).values({
      key: 'siteInfo',
      value: JSON.stringify(defaultInfo),
    });

    return defaultInfo;
  }

  async updateSiteInfo(dto: UpdateSiteInfoDto): Promise<SiteInfo> {
    const updatedInfo: SiteInfo = dto;

    const existing = await this.db
      .select()
      .from(siteMeta)
      .where(eq(siteMeta.key, 'siteInfo'))
      .limit(1);

    if (existing.length > 0) {
      await this.db
        .update(siteMeta)
        .set({
          value: JSON.stringify(updatedInfo),
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(siteMeta.key, 'siteInfo'));
    } else {
      await this.db.insert(siteMeta).values({
        key: 'siteInfo',
        value: JSON.stringify(updatedInfo),
      });
    }

    return updatedInfo;
  }

  async getLayoutSettings(): Promise<SiteLayout> {
    const results = await this.db
      .select()
      .from(siteMeta)
      .where(eq(siteMeta.key, 'siteLayout'))
      .limit(1);

    if (results.length > 0 && results[0].value) {
      return JSON.parse(results[0].value) as SiteLayout;
    }

    // Return default layout settings
    const defaultLayout: SiteLayout = {
      showRecentPosts: true,
      recentPostsCount: 5,
      showCategories: true,
      showTags: true,
      showArchive: true,
      showAbout: true,
      showSearch: true,
    };

    await this.db.insert(siteMeta).values({
      key: 'siteLayout',
      value: JSON.stringify(defaultLayout),
    });

    return defaultLayout;
  }

  async updateLayoutSettings(dto: UpdateLayoutDto): Promise<SiteLayout> {
    const existing = await this.getLayoutSettings();
    const updatedLayout: SiteLayout = Object.assign({}, existing, dto);

    const existingRecord = await this.db
      .select()
      .from(siteMeta)
      .where(eq(siteMeta.key, 'siteLayout'))
      .limit(1);

    if (existingRecord.length > 0) {
      await this.db
        .update(siteMeta)
        .set({
          value: JSON.stringify(updatedLayout),
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(siteMeta.key, 'siteLayout'));
    } else {
      await this.db.insert(siteMeta).values({
        key: 'siteLayout',
        value: JSON.stringify(updatedLayout),
      });
    }

    return updatedLayout;
  }

  async getThemeSettings(): Promise<SiteTheme> {
    const results = await this.db
      .select()
      .from(siteMeta)
      .where(eq(siteMeta.key, 'siteTheme'))
      .limit(1);

    if (results.length > 0 && results[0].value) {
      return JSON.parse(results[0].value) as SiteTheme;
    }

    // Return default theme settings
    const defaultTheme: SiteTheme = {
      primaryColor: '#007BFF',
      darkMode: false,
    };

    await this.db.insert(siteMeta).values({
      key: 'siteTheme',
      value: JSON.stringify(defaultTheme),
    });

    return defaultTheme;
  }

  async updateThemeSettings(dto: UpdateThemeDto): Promise<SiteTheme> {
    const existing = await this.getThemeSettings();
    const updatedTheme: SiteTheme = Object.assign({}, existing, dto);

    const existingRecord = await this.db
      .select()
      .from(siteMeta)
      .where(eq(siteMeta.key, 'siteTheme'))
      .limit(1);

    if (existingRecord.length > 0) {
      await this.db
        .update(siteMeta)
        .set({
          value: JSON.stringify(updatedTheme),
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(siteMeta.key, 'siteTheme'));
    } else {
      await this.db.insert(siteMeta).values({
        key: 'siteTheme',
        value: JSON.stringify(updatedTheme),
      });
    }

    return updatedTheme;
  }

  async getFriendLinks(): Promise<FriendLink[]> {
    const results = await this.db
      .select()
      .from(siteMeta)
      .where(eq(siteMeta.key, 'friendLinks'))
      .limit(1);

    if (results.length > 0 && results[0].value) {
      return JSON.parse(results[0].value) as FriendLink[];
    }

    // Return empty array as default
    const defaultLinks: FriendLink[] = [];

    await this.db.insert(siteMeta).values({
      key: 'friendLinks',
      value: JSON.stringify(defaultLinks),
    });

    return defaultLinks;
  }

  async createFriendLink(dto: CreateFriendLinkDto): Promise<FriendLink[]> {
    const friends = await this.getFriendLinks();
    friends.push(dto);

    const existingRecord = await this.db
      .select()
      .from(siteMeta)
      .where(eq(siteMeta.key, 'friendLinks'))
      .limit(1);

    if (existingRecord.length > 0) {
      await this.db
        .update(siteMeta)
        .set({
          value: JSON.stringify(friends),
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(siteMeta.key, 'friendLinks'));
    } else {
      await this.db.insert(siteMeta).values({
        key: 'friendLinks',
        value: JSON.stringify(friends),
      });
    }

    return friends;
  }

  async updateFriendLink(index: number, dto: UpdateFriendLinkDto): Promise<FriendLink[]> {
    const friends = await this.getFriendLinks();
    if (index < 0 || index >= friends.length) {
      throw new Error('Invalid index');
    }

    friends[index] = Object.assign({}, friends[index], dto);

    await this.db
      .update(siteMeta)
      .set({
        value: JSON.stringify(friends),
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(siteMeta.key, 'friendLinks'));

    return friends;
  }

  async deleteFriendLink(index: number): Promise<FriendLink[]> {
    const friends = await this.getFriendLinks();
    if (index < 0 || index >= friends.length) {
      throw new Error('Invalid index');
    }

    friends.splice(index, 1);

    await this.db
      .update(siteMeta)
      .set({
        value: JSON.stringify(friends),
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(siteMeta.key, 'friendLinks'));

    return friends;
  }

  async getNavigation(): Promise<Navigation[]> {
    const results = await this.db
      .select()
      .from(siteMeta)
      .where(eq(siteMeta.key, 'navigation'))
      .limit(1);

    if (results.length > 0 && results[0].value) {
      return JSON.parse(results[0].value) as Navigation[];
    }

    // Return default navigation
    const defaultNavigation: Navigation[] = [
      { name: 'Home', path: '/' },
      { name: 'Archive', path: '/archive' },
      { name: 'About', path: '/about' },
    ];

    await this.db.insert(siteMeta).values({
      key: 'navigation',
      value: JSON.stringify(defaultNavigation),
    });

    return defaultNavigation;
  }

  async updateNavigation(dto: UpdateNavigationDto): Promise<Navigation[]> {
    const existingRecord = await this.db
      .select()
      .from(siteMeta)
      .where(eq(siteMeta.key, 'navigation'))
      .limit(1);

    if (existingRecord.length > 0) {
      await this.db
        .update(siteMeta)
        .set({
          value: JSON.stringify(dto.items),
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(siteMeta.key, 'navigation'));
    } else {
      await this.db.insert(siteMeta).values({
        key: 'navigation',
        value: JSON.stringify(dto.items),
      });
    }

    return dto.items;
  }

  async getCustomCode(): Promise<CustomCode> {
    const results = await this.db
      .select()
      .from(siteMeta)
      .where(eq(siteMeta.key, 'customCode'))
      .limit(1);

    if (results.length > 0 && results[0].value) {
      return JSON.parse(results[0].value) as CustomCode;
    }

    // Return empty custom code as default
    const defaultCode: CustomCode = {};

    await this.db.insert(siteMeta).values({
      key: 'customCode',
      value: JSON.stringify(defaultCode),
    });

    return defaultCode;
  }

  async updateCustomCode(dto: UpdateCustomCodeDto): Promise<CustomCode> {
    const existing = await this.getCustomCode();
    const updatedCode: CustomCode = Object.assign({}, existing, dto);

    const existingRecord = await this.db
      .select()
      .from(siteMeta)
      .where(eq(siteMeta.key, 'customCode'))
      .limit(1);

    if (existingRecord.length > 0) {
      await this.db
        .update(siteMeta)
        .set({
          value: JSON.stringify(updatedCode),
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(siteMeta.key, 'customCode'));
    } else {
      await this.db.insert(siteMeta).values({
        key: 'customCode',
        value: JSON.stringify(updatedCode),
      });
    }

    return updatedCode;
  }
}
