import * as fs from 'fs';

import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import axios from 'axios';
import dayjs from 'dayjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { DATABASE_CONNECTION, type Database } from '../../../database';
import { siteMeta } from '../../../database/schema';
import { normalizeCustomCode } from '../../../shared/contracts';
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
  readonly css?: string;
  readonly script?: string;
  readonly html?: string;
  readonly head?: string;
}

// 新增：关于信息
export interface AboutInfo {
  content: string;
  updatedAt: string;
}

export type SocialType = 'bilibili' | 'email' | 'github' | 'gitee' | 'wechat' | 'wechat-dark';

export interface SocialItem {
  type: SocialType;
  value: string;
  updatedAt: string | Date;
}

export interface SocialTypeInfo {
  label: string;
  value: SocialType;
}

// 新增：其他设置接口
export interface WalineSetting {
  'smtp.enabled': boolean;
  'smtp.port': number;
  'smtp.host': string;
  'smtp.user': string;
  'smtp.password': string;
  'sender.name': string;
  'sender.email': string;
  authorEmail: string;
  webhook?: string;
  forceLoginComment: boolean;
  otherConfig?: string;
  serverURL?: string;
}

export interface ISRSetting {
  mode: 'delay' | 'onDemand';
  delay: number;
}

export interface LoginSetting {
  enableMaxLoginRetry: boolean;
  maxRetryTimes: number;
  durationSeconds: number;
  expiresIn: number;
}

export interface RewardItem {
  name: string;
  value: string;
  updatedAt: string | Date;
}

export interface HttpsSetting {
  redirect: boolean;
}

export interface StaticSetting {
  storageType: 'picgo' | 'local';
  picgoConfig?: unknown;
  picgoPlugins?: string;
  enableWaterMark: boolean;
  waterMarkText?: string;
  enableWebp: boolean;
}

@Injectable()
export class SettingCoreService implements OnModuleInit {
  private readonly logger = new Logger(SettingCoreService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly hookService: HookService,
    private readonly registryService: SettingRegistryService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.initCaddy();
  }

  async initCaddy(): Promise<void> {
    const httpsSetting = await this.getHttpsSetting();
    await this.setCaddyRedirect(httpsSetting.redirect);
  }

  async setCaddyRedirect(redirect: boolean): Promise<void> {
    if (!redirect) {
      try {
        await axios.delete('http://127.0.0.1:2019/config/apps/http/servers/srv1/listener_wrappers');
        this.logger.log('https 自动重定向已关闭');
      } catch (_err) {
        this.logger.error('关闭 https 自动重定向失败');
      }
    } else {
      try {
        await axios.post('http://127.0.0.1:2019/config/apps/http/servers/srv1/listener_wrappers', [
          {
            wrapper: 'http_redirect',
          },
        ]);
        this.logger.log('https 自动重定向已开启');
      } catch (_err) {
        this.logger.error('开启 https 自动重定向失败');
      }
    }
  }

  // Generic config methods with optional schema validation
  async getConfig<T>(key: string, defaultValue?: T, schema?: z.ZodType<T>): Promise<T | null> {
    const results = await this.db.select().from(siteMeta).where(eq(siteMeta.key, key)).limit(1);

    if (results.length > 0 && results[0].value) {
      if (schema) {
        const parsed = safeParseJson<T>(results[0].value, schema);
        return parsed;
      }
      const parsed = safeParseJson<Record<string, unknown>>(
        results[0].value,
        dataSchemas.genericObject,
      );
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

    const parsed = oldValue != null ? safeParseJson(oldValue, dataSchemas.genericObject) : null;

    // Extended payload: emit with parsed oldValue object and updatedAt FIRST
    await this.hookService.doAction('setting|afterUpdate', {
      key,
      value: filteredData.value,
      oldValue: parsed,
      updatedAt: new Date().toISOString(),
    });

    // Backward compatibility: emit with raw string oldValue AFTER
    await this.hookService.doAction('setting|afterUpdate', {
      key,
      value: filteredData.value,
      oldValue,
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
    await this.updateConfig('friendLinks', friends);
    return friends;
  }

  async updateFriendLink(index: number, dto: Partial<FriendLink>): Promise<FriendLink[]> {
    const friends = await this.getFriendLinks();
    if (index < 0 || index >= friends.length) {
      throw new Error('Invalid index');
    }
    friends[index] = { ...friends[index], ...dto };
    await this.updateConfig('friendLinks', friends);
    return friends;
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
    const rawConfig = await this.getConfig<CustomCode>('customCode');
    return rawConfig ? normalizeCustomCode(rawConfig) : normalizeCustomCode(null);
  }

  async updateCustomCode(dto: Partial<CustomCode>): Promise<CustomCode> {
    const existing = await this.getCustomCode();
    const updated = { ...existing, ...dto };
    return this.updateConfig('customCode', updated);
  }

  // About Info
  async getAboutInfo(): Promise<AboutInfo> {
    const defaultAbout: AboutInfo = {
      content: '',
      updatedAt: dayjs().toISOString(),
    };
    return (await this.getConfig<AboutInfo>('aboutInfo', defaultAbout)) ?? defaultAbout;
  }

  async updateAboutInfo(dto: Partial<AboutInfo>): Promise<AboutInfo> {
    const existing = await this.getAboutInfo();
    const updated: AboutInfo = {
      content: dto.content ?? existing.content,
      updatedAt: dayjs().toISOString(),
    };
    return this.updateConfig('aboutInfo', updated);
  }

  // Social
  async getSocials(): Promise<SocialItem[]> {
    return (await this.getConfig<SocialItem[]>('socials')) ?? [];
  }

  async updateSocial(dto: { type: SocialType; value: string }): Promise<SocialItem[]> {
    const socials = await this.getSocials();
    const index = socials.findIndex((s) => s.type === dto.type);
    const newItem: SocialItem = {
      type: dto.type,
      value: dto.value,
      updatedAt: dayjs().toISOString(),
    };

    if (index !== -1) {
      socials[index] = newItem;
    } else {
      socials.push(newItem);
    }
    return this.updateConfig('socials', socials);
  }

  async deleteSocial(type: SocialType): Promise<SocialItem[]> {
    const socials = await this.getSocials();
    const newSocials = socials.filter((s) => s.type !== type);
    return this.updateConfig('socials', newSocials);
  }

  getSocialTypes(): SocialTypeInfo[] {
    return [
      { label: '哔哩哔哩', value: 'bilibili' },
      { label: '邮箱', value: 'email' },
      { label: 'GitHub', value: 'github' },
      { label: 'Gitee', value: 'gitee' },
      { label: '微信', value: 'wechat' },
      { label: '微信（暗色模式）', value: 'wechat-dark' },
    ];
  }

  // Waline
  async getWalineSetting(): Promise<WalineSetting> {
    const defaultWaline: WalineSetting = {
      'smtp.enabled': false,
      'smtp.port': 465,
      'smtp.host': '',
      'smtp.user': '',
      'smtp.password': '',
      'sender.name': '',
      'sender.email': '',
      authorEmail: '',
      forceLoginComment: false,
    };
    return (await this.getConfig<WalineSetting>('waline', defaultWaline)) ?? defaultWaline;
  }

  async updateWalineSetting(dto: Partial<WalineSetting>): Promise<WalineSetting> {
    const existing = await this.getWalineSetting();
    const updated = { ...existing, ...dto };
    return this.updateConfig('waline', updated);
  }

  // ISR
  async getISRSetting(): Promise<ISRSetting> {
    const defaultISR: ISRSetting = {
      mode: 'onDemand',
      delay: 0,
    };
    return (await this.getConfig<ISRSetting>('isr', defaultISR)) ?? defaultISR;
  }

  async updateISRSetting(dto: Partial<ISRSetting>): Promise<ISRSetting> {
    const existing = await this.getISRSetting();
    const updated = { ...existing, ...dto };
    return this.updateConfig('isr', updated);
  }

  // Login
  async getLoginSetting(): Promise<LoginSetting> {
    const defaultLogin: LoginSetting = {
      enableMaxLoginRetry: false,
      maxRetryTimes: 5,
      durationSeconds: 300,
      expiresIn: 7200,
    };
    return (await this.getConfig<LoginSetting>('login', defaultLogin)) ?? defaultLogin;
  }

  async updateLoginSetting(dto: Partial<LoginSetting>): Promise<LoginSetting> {
    const existing = await this.getLoginSetting();
    const updated = { ...existing, ...dto };
    return this.updateConfig('login', updated);
  }

  // HTTPS
  async getHttpsSetting(): Promise<HttpsSetting> {
    const defaultHttps: HttpsSetting = {
      redirect: false,
    };
    return (await this.getConfig<HttpsSetting>('https', defaultHttps)) ?? defaultHttps;
  }

  async updateHttpsSetting(dto: HttpsSetting): Promise<HttpsSetting> {
    const result = await this.updateConfig('https', dto);
    await this.setCaddyRedirect(dto.redirect);
    return result;
  }

  // Static (Media)
  async getStaticSetting(): Promise<StaticSetting> {
    const defaultStatic: StaticSetting = {
      storageType: 'local',
      enableWaterMark: false,
      enableWebp: true,
    };
    return (await this.getConfig<StaticSetting>('static', defaultStatic)) ?? defaultStatic;
  }

  async updateStaticSetting(dto: StaticSetting): Promise<StaticSetting> {
    return this.updateConfig('static', dto);
  }

  // Reward Settings
  async getRewards(): Promise<RewardItem[]> {
    return (await this.getConfig<RewardItem[]>('reward', [])) ?? [];
  }

  async createReward(dto: { name: string; value: string }): Promise<RewardItem> {
    const rewards = await this.getRewards();
    const newItem: RewardItem = {
      ...dto,
      updatedAt: dayjs().toISOString(),
    };

    // Check if exists
    const index = rewards.findIndex((r) => r.name === dto.name);
    if (index !== -1) {
      rewards[index] = newItem;
    } else {
      rewards.push(newItem);
    }

    await this.updateConfig('reward', rewards);
    return newItem;
  }

  async updateReward(name: string, dto: { name: string; value: string }): Promise<RewardItem> {
    const rewards = await this.getRewards();
    const index = rewards.findIndex((r) => r.name === name);

    if (index === -1) {
      throw new Error(`Reward with name ${name} not found`);
    }

    const updatedItem: RewardItem = {
      ...dto,
      updatedAt: dayjs().toISOString(),
    };

    rewards[index] = updatedItem;
    await this.updateConfig('reward', rewards);
    return updatedItem;
  }

  async deleteReward(name: string): Promise<boolean> {
    const rewards = await this.getRewards();
    const newRewards = rewards.filter((r) => r.name !== name);

    if (newRewards.length === rewards.length) {
      return false;
    }

    await this.updateConfig('reward', newRewards);
    return true;
  }

  // Caddy Settings
  getCaddyLog(): string {
    try {
      const data = fs.readFileSync('/var/log/caddy.log', { encoding: 'utf-8' });
      return data.toString();
    } catch (_err) {
      return '';
    }
  }

  clearCaddyLog(): void {
    try {
      fs.writeFileSync('/var/log/caddy.log', '');
    } catch (_err) {
      // ignore
    }
  }

  async getCaddyConfig(): Promise<unknown> {
    try {
      const res = await axios.get('http://127.0.0.1:2019/config');
      return res.data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`获取 Caddy 配置失败: ${msg}`);
      return null;
    }
  }
}
