/**
 * 日期辅助：统一「距今多少天」的计算，供过期提醒等使用。
 */

/** 距今天数（毫秒差向下取整）。非法输入返回 0。 */
export function daysSince(raw: string | undefined | null): number {
  if (!raw) return 0;
  const d = new Date(raw.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}
