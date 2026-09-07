/* UPSTREAM: packages/website/utils/capitalize.ts@4b488500be8100b19772ec00d8315f343a6ac21e
 * SEAM: 无 — 逐字搬运。上游 fix → apply patch。
 */
export const capitalize = (content: string): string =>
  content.substring(0, 1).toLocaleUpperCase() + content.substring(1);
