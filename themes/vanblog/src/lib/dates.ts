/**
 * 日期辅助：统一「距今多少天」的计算，供过期提醒等使用。
 */

/** 距今天数（毫秒差向下取整）。非法输入返回 0。 */
export function daysSince(raw: string | undefined | null): number {
  if (!raw) return 0;
  const d = new Date(raw.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

/**
 * 格式化日期为 YYYY-MM-DD（原版 dayjs format("YYYY-MM-DD")）。
 * 注意：@vanblog/sdk 的 fmtDate 用 toLocaleDateString('zh-CN') 输出 2026/8/5，
 * 与原版不一致，故主题内统一走本函数。非法输入返回空串。
 */
export function fmtDate(raw: string | undefined | null): string {
  if (!raw) return "";
  const d = new Date(raw.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
