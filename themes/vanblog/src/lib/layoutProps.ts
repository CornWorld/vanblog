/**
 * PostCard 相关布局开关(原版 utils/getLayoutProps.ts 的平台字段映射)。
 * 上游默认全 "true",仅当站点显式 false 时关闭;评论开关取平台 commentsProvider。
 * copyright 字段:平台已改名 copyrightAgreement(单 g),上游 prop 名保留原拼写。
 */
import type { Site } from '@vanblog/sdk';

export interface PostCardLayoutProps {
  enableComment: 'true' | 'false';
  showExpirationReminder: 'true' | 'false';
  showEditButton: 'true' | 'false';
  showDonateButton: 'true' | 'false';
  showCopyRight: 'true' | 'false';
  /** 上游 prop 名保留 typo(copyrightAggreement),值取平台 copyrightAgreement */
  copyrightAggreement: string;
  commentsServer: string;
  commentsSite: string;
}

// getSite() 返回 Partial 形态,签名放宽到结构兼容
export function getPostCardLayoutProps(site: Partial<Site> | null | undefined): PostCardLayoutProps {
  const cfg = (site?.commentsConfig ?? {}) as Record<string, unknown>;
  const provider = String(site?.commentsProvider || '');
  return {
    enableComment: provider && provider !== 'disabled' && provider !== 'off' ? 'true' : 'false',
    showExpirationReminder: site?.displayOptions?.showExpirationReminder === false ? 'false' : 'true',
    showEditButton: site?.displayOptions?.showEditButton === false ? 'false' : 'true',
    showDonateButton: site?.displayOptions?.showDonateButton === false ? 'false' : 'true',
    showCopyRight: site?.displayOptions?.showCopyRight === false ? 'false' : 'true',
    copyrightAggreement: String(site?.copyrightAgreement ?? ''),
    commentsServer: String(cfg.server || '').replace(/\/+$/, ''),
    commentsSite: String(cfg.site || 'VanBlog'),
  };
}
