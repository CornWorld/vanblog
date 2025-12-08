import dayjsBase from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

// 扩展 dayjs 以支持 UTC 和时区功能
// Extend dayjs with UTC and timezone plugins
dayjsBase.extend(utc);
dayjsBase.extend(timezone);

/**
 * dayjs 实例（已扩展 UTC 和时区支持）
 *
 * dayjs instance with UTC and timezone support enabled
 */
export const dayjs: typeof dayjsBase = dayjsBase;
export type { Dayjs } from 'dayjs';

/**
 * 配置 dayjs 的语言和时区
 *
 * Configure dayjs locale and timezone settings.
 *
 * @param options - 配置选项
 * @param options.locale - 语言代码（如 'zh-cn', 'en'）
 * @param options.timezone - 时区（当前未使用，保留供未来扩展）
 *
 * @example
 * ```ts
 * await configureDayjs({ locale: 'zh-cn' });
 * ```
 */
export async function configureDayjs(options: {
  locale?: string;
  timezone?: string;
}): Promise<void> {
  const { locale } = options;
  if (locale && locale !== 'en') {
    try {
      await import(`dayjs/locale/${locale}`);
      dayjs.locale(locale);
    } catch {
      dayjs.locale('en');
    }
  } else if (locale) {
    dayjs.locale(locale);
  }
}

/**
 * 获取当前时间的 ISO 8601 格式字符串（带时区）
 *
 * Get current time as ISO 8601 string with timezone.
 *
 * @returns ISO 8601 格式的时间字符串
 *
 * @example
 * ```ts
 * nowIsoTz() // "2025-12-08T10:30:00+08:00"
 * ```
 */
export function nowIsoTz(): string {
  return dayjs().format();
}

/**
 * 将输入转换为 ISO 8601 格式字符串（带时区）
 *
 * Convert input to ISO 8601 string with timezone.
 *
 * @param input - dayjs 支持的任何输入格式（Date, string, timestamp 等）
 * @returns ISO 8601 格式的时间字符串
 *
 * @example
 * ```ts
 * toIsoTzString(new Date()) // "2025-12-08T10:30:00+08:00"
 * toIsoTzString('2025-12-08') // "2025-12-08T00:00:00+08:00"
 * ```
 */
export function toIsoTzString(input?: Parameters<typeof dayjs>[0]): string {
  return dayjs(input).format();
}
