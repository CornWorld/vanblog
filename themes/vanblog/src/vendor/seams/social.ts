/* SEAM: 上游 types SocialItem(api/getAllData 内联形状)。
 * dark = wechat-dark 变体二维码(与 SocialCard 的合并逻辑配套)。 */
export interface SocialItem {
  type: string;
  value: string;
  dark?: string;
}

export interface LinkItem {
  name: string;
  url: string;
  logo?: string;
  desc?: string;
}
