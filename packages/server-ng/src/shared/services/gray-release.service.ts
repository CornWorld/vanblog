import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type GrayFeature = 'pathname' | 'password';

export interface GrayContext {
  id?: string; // user id if available
  ip?: string; // client ip
  ua?: string; // user agent
  pathname?: string; // article pathname when related
  articleId?: string; // article id when related
}

interface FeatureConfig {
  enabled: boolean;
  percentage: number; // 0-100
  whitelist: string[]; // ids or pathnames depending on feature
}

@Injectable()
export class GrayReleaseService {
  private readonly globalEnabled: boolean;

  constructor(private readonly config: ConfigService) {
    const raw = this.config.get<string>('ROLLOUT_ENABLED', 'false');
    this.globalEnabled = String(raw).toLowerCase() === 'true';
  }

  /**
   * 判断 feature 是否启用新的行为（灰度）
   */
  isEnabledFor(feature: GrayFeature, ctx: GrayContext = {}): boolean {
    if (!this.globalEnabled) return false;

    const conf = this.getFeatureConfig(feature);
    if (!conf.enabled) return false;

    // 白名单优先
    const candidate = this.getCandidateKey(feature, ctx);
    if (candidate !== undefined && candidate !== '' && conf.whitelist.includes(candidate))
      return true;

    // 百分比灰度
    if (conf.percentage <= 0) return false;
    if (conf.percentage >= 100) return true;

    const subject = this.getSubjectKey(feature, ctx);
    if (subject.length === 0) return false;

    const bucket = this.hashToBucket(subject);
    return bucket < conf.percentage;
  }

  /** 便捷方法：pathname 相关灰度 */
  isPathnameEnabled(ctx: GrayContext = {}): boolean {
    return this.isEnabledFor('pathname', ctx);
  }

  /** 便捷方法：文章密码相关灰度 */
  isPasswordEnabled(ctx: GrayContext = {}): boolean {
    return this.isEnabledFor('password', ctx);
  }

  // --- internal helpers ---

  private getFeatureConfig(feature: GrayFeature): FeatureConfig {
    const prefix = feature.toUpperCase();
    const enabledKey = `ROLLOUT_${prefix}_ENABLED`;
    const percentKey = `ROLLOUT_${prefix}_PERCENT`;
    const whitelistKey = `ROLLOUT_${prefix}_WHITELIST`;

    const enabledRaw = this.config.get<string>(enabledKey, 'true');
    const enabled = String(enabledRaw).toLowerCase() === 'true';

    const percentRaw = this.config.get<string | number>(percentKey);
    let percentage = Number(percentRaw ?? 0);
    if (!Number.isFinite(percentage) || percentage < 0) percentage = 0;
    if (percentage > 100) percentage = 100;

    const whitelistCsv = this.config.get<string>(whitelistKey, '');
    const whitelist = whitelistCsv
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    return { enabled, percentage, whitelist };
  }

  private getCandidateKey(feature: GrayFeature, ctx: GrayContext): string | undefined {
    switch (feature) {
      case 'pathname':
        return ctx.pathname?.trim();
      case 'password':
        return (ctx.articleId ?? ctx.pathname)?.trim();
      default: {
        const _exhaustiveCheck: never = feature;
        return _exhaustiveCheck;
      }
    }
  }

  private getSubjectKey(feature: GrayFeature, ctx: GrayContext): string {
    // 尽量稳定且与访问者相关，避免 SEO 突变
    // 优先使用用户 id，其次 ip，再次 ua，最后回退到 pathname/articleId
    const base = ctx.id ?? ctx.ip ?? ctx.ua ?? '';
    const secondary = this.getCandidateKey(feature, ctx) ?? '';
    return `${feature}:${base}:${secondary}`;
  }

  private hashToBucket(input: string): number {
    // 简单且稳定的 djb2 哈希，结果 0-99 桶
    let hash = 5381;
    for (let i = 0; i < input.length; i++) {
      hash = (hash << 5) + hash + input.charCodeAt(i);
      hash |= 0; // 32-bit
    }
    const positive = Math.abs(hash);
    return positive % 100;
  }
}
