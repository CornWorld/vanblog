/**
 * Email Notification Plugin
 *
 * 邮件通知插件：在文章发布、评论等事件时发送邮件通知
 *
 * 使用 v2.0 函数式 API
 */

import * as nodemailer from 'nodemailer';

import type { PluginAPI } from '@vanblog/shared/plugin';

// 定义邮件配置接口
interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  to: string[];
}

// 定义文章数据类型
interface ArticleData {
  [key: string]: unknown;
  id?: string;
  title?: string;
  content?: string;
  author?: string;
  createdAt?: string;
  updatedAt?: string;
}

// 定义评论数据类型
interface CommentData {
  [key: string]: unknown;
  articleId?: string;
  author?: string;
  content?: string;
  email?: string;
}

// 定义草稿数据类型
interface DraftData {
  [key: string]: unknown;
  title?: string;
  author?: string;
  articleId?: string | number;
  createdAt?: string;
  publishedAt?: string;
  content?: string;
}

export default (api: PluginAPI) => {
  api.log.info('邮件通知插件正在初始化...');

  // 响应式存储
  const emailEnabled = api.store('email_enabled', false);
  const emailsSent = api.store('emails_sent', 0);

  // 获取邮件配置
  function getEmailConfig(): EmailConfig | null {
    const hostRaw = api.config.smtp_host;
    const host = typeof hostRaw === 'string' ? hostRaw.trim() : '';

    const portRaw = api.config.smtp_port;
    let port: number | null = null;
    if (typeof portRaw === 'number' && Number.isFinite(portRaw)) {
      port = portRaw;
    } else if (typeof portRaw === 'string' && portRaw.trim() !== '') {
      const parsed = Number(portRaw);
      if (Number.isFinite(parsed)) {
        port = parsed;
      }
    }

    const secureRaw = api.config.smtp_secure;
    const secure =
      secureRaw === true || (typeof secureRaw === 'string' && secureRaw.toLowerCase() === 'true');

    const userRaw = api.config.smtp_user;
    const user = typeof userRaw === 'string' ? userRaw.trim() : '';

    const passRaw = api.config.smtp_pass;
    const pass = typeof passRaw === 'string' ? passRaw.trim() : '';

    const fromRaw = api.config.email_from;
    const from = typeof fromRaw === 'string' ? fromRaw.trim() : '';

    const toRaw = api.config.email_to;
    let to: string[] = [];
    if (Array.isArray(toRaw)) {
      to = toRaw
        .filter((x): x is string => typeof x === 'string' && x.trim() !== '')
        .map((s) => s.trim());
    } else if (typeof toRaw === 'string') {
      to = toRaw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }

    // 配置不完整时返回 null
    if (
      host.length === 0 ||
      user.length === 0 ||
      pass.length === 0 ||
      from.length === 0 ||
      port === null ||
      to.length === 0
    ) {
      return null;
    }

    return { host, port, secure, auth: { user, pass }, from, to };
  }

  // 发送邮件
  async function sendEmail(subject: string, content: string): Promise<void> {
    if (!emailEnabled.value) {
      api.log.warn('邮件功能未启用，跳过发送');
      return;
    }

    const emailConfig = getEmailConfig();
    if (!emailConfig) {
      api.log.error('邮件配置获取失败');
      return;
    }

    try {
      const transporter = nodemailer.createTransport({
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure,
        auth: emailConfig.auth,
      });

      await transporter.sendMail({
        from: emailConfig.from,
        to: emailConfig.to.join(', '),
        subject,
        html: content,
      });

      // 更新发送计数
      emailsSent.value += 1;

      api.log.info(`邮件发送成功: ${subject}`);
    } catch (error) {
      api.log.error(`邮件发送失败: ${String(error)}`);
    }
  }

  // 文章创建后发送通知
  api.action('article.afterCreate', (article: ArticleData) => {
    const subject = `📝 新文章发布：${article.title ?? '无标题'}`;
    const content = `
      <h2>新文章发布通知</h2>
      <p><strong>标题：</strong>${article.title ?? '无标题'}</p>
      <p><strong>作者：</strong>${article.author ?? '未知'}</p>
      <p><strong>发布时间：</strong>${article.createdAt ?? '未知'}</p>
      <p><strong>内容预览：</strong></p>
      <div style="border-left: 3px solid #007cba; padding-left: 15px; margin: 10px 0;">
        ${(article.content ?? '').substring(0, 200)}${(article.content ?? '').length > 200 ? '...' : ''}
      </div>
      <p>请登录后台查看完整内容。</p>
    `;

    void sendEmail(subject, content);
  });

  // 文章更新后发送通知
  api.action('article.afterUpdate', (article: ArticleData) => {
    const subject = `✏️ 文章更新：${article.title ?? '无标题'}`;
    const content = `
      <h2>文章更新通知</h2>
      <p><strong>标题：</strong>${article.title ?? '无标题'}</p>
      <p><strong>作者：</strong>${article.author ?? '未知'}</p>
      <p><strong>更新时间：</strong>${article.updatedAt ?? '未知'}</p>
      <p><strong>内容预览：</strong></p>
      <div style="border-left: 3px solid #28a745; padding-left: 15px; margin: 10px 0;">
        ${(article.content ?? '').substring(0, 200)}${(article.content ?? '').length > 200 ? '...' : ''}
      </div>
      <p>请登录后台查看完整内容。</p>
    `;

    void sendEmail(subject, content);
  });

  // 评论更新后发送通知
  api.action('comment.afterUpdate', (comment: CommentData) => {
    const subject = `💬 评论系统更新通知`;
    const content = `
      <h2>评论系统更新通知</h2>
      <p><strong>文章ID：</strong>${comment.articleId ?? '未知'}</p>
      <p><strong>评论者：</strong>${comment.author ?? '匿名'}</p>
      <p><strong>邮箱：</strong>${comment.email ?? '未提供'}</p>
      <p><strong>评论内容：</strong></p>
      <div style="border-left: 3px solid #ffc107; padding-left: 15px; margin: 10px 0;">
        ${(comment.content ?? '').substring(0, 200)}${(comment.content ?? '').length > 200 ? '...' : ''}
      </div>
      <p>请登录后台查看详细信息。</p>
    `;

    void sendEmail(subject, content);
  });

  // 草稿发布后发送通知
  api.action('draft.afterPublish', (draft: DraftData) => {
    const subject = `📢 草稿发布通知：${draft.title ?? '无标题'}`;
    const content = `
      <h2>草稿发布通知</h2>
      <p><strong>标题：</strong>${draft.title ?? '无标题'}</p>
      <p><strong>作者：</strong>${draft.author ?? '未知'}</p>
      <p><strong>文章ID：</strong>${String(draft.articleId ?? '未知')}</p>
      <p><strong>发布时间：</strong>${draft.publishedAt ?? draft.createdAt ?? '未知'}</p>
      <p><strong>内容预览：</strong></p>
      <div style="border-left: 3px solid #17a2b8; padding-left: 15px; margin: 10px 0;">
        ${(draft.content ?? '').substring(0, 200)}${(draft.content ?? '').length > 200 ? '...' : ''}
      </div>
      <p>请登录后台查看完整内容。</p>
    `;

    void sendEmail(subject, content);
  });

  // 生命周期钩子
  api.onActivate(() => {
    // 验证邮件配置
    const emailConfig = getEmailConfig();
    if (!emailConfig) {
      api.log.warn('邮件配置不完整，插件将不会发送邮件');
      emailEnabled.value = false;
    } else {
      api.log.info('邮件配置验证成功');
      emailEnabled.value = true;
    }

    api.log.info('邮件通知插件初始化成功');
  });

  api.onDeactivate(() => {
    api.log.info(`插件销毁，共发送 ${emailsSent.value} 封邮件`);
  });
};
