import dayjsBase from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjsBase.extend(utc);
dayjsBase.extend(timezone);

export const dayjs: typeof dayjsBase = dayjsBase;
export type { Dayjs } from 'dayjs';

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

export function nowIsoTz(): string {
  return dayjs().format();
}

export function toIsoTzString(input?: Parameters<typeof dayjs>[0]): string {
  return dayjs(input).format();
}
