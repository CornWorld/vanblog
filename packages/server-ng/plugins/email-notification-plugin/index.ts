// 邮件通知插件：在文章发布、评论等事件时发送邮件通知

import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

import { withPluginPrefix } from '../../src/modules/plugin/utils/prefix.util';

import type { ActionCallback } from '../../src/modules/plugin/interfaces/hook.interface';
import type { PluginContext } from '../../src/modules/plugin/interfaces/plugin-context.interface';
import type { Plugin } from '../../src/modules/plugin/services/plugin-loader.service';

const PLUGIN_PREFIX = withPluginPrefix('email-notification-plugin');
const logger = new Logger(PLUGIN_PREFIX);

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

// 基础类型守卫：非空对象
function isNonNullObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

// PluginDataStorage 方法守卫
function hasDataStorage(
  o: unknown,
): o is Pick<PluginContext['data'], 'get' | 'set'> & Partial<Pick<PluginContext['data'], 'clear'>> {
  if (!isNonNullObject(o)) return false;
  const g = (o as { get?: unknown }).get;
  const s = (o as { set?: unknown }).set;
  return typeof g === 'function' && typeof s === 'function';
}

// PluginConfigReader 方法守卫
function hasConfigReader(o: unknown): o is Pick<PluginContext['config'], 'get'> {
  if (!isNonNullObject(o)) return false;
  const g = (o as { get?: unknown }).get;
  return typeof g === 'function';
}

// 类型守卫：判断是否为 PluginContext（放宽：不强制 pluginId）
function isPluginContext(x: unknown): x is PluginContext {
  if (x == null || typeof x !== 'object') return false;
  const obj = x as { data?: unknown; config?: unknown };
  return hasDataStorage(obj.data) && hasConfigReader(obj.config);
}

// 获取邮件配置
function getEmailConfig(context: PluginContext): EmailConfig | null {
  // 使用更安全的读取方式并提供兜底
  const hostRaw = context.config.get('smtp_host');
  const host = typeof hostRaw === 'string' ? hostRaw.trim() : '';

  const portRaw = context.config.get('smtp_port');
  let port: number | null = null;
  if (typeof portRaw === 'number' && Number.isFinite(portRaw)) {
    port = portRaw;
  } else if (typeof portRaw === 'string' && portRaw.trim() !== '') {
    const parsed = Number(portRaw);
    if (Number.isFinite(parsed)) {
      port = parsed;
    }
  }

  const secureRaw = context.config.get('smtp_secure');
  const secure =
    secureRaw === true || (typeof secureRaw === 'string' && secureRaw.toLowerCase() === 'true');

  const userRaw = context.config.get('smtp_user');
  const user = typeof userRaw === 'string' ? userRaw.trim() : '';

  const passRaw = context.config.get('smtp_pass');
  const pass = typeof passRaw === 'string' ? passRaw.trim() : '';

  const fromRaw = context.config.get('email_from');
  const from = typeof fromRaw === 'string' ? fromRaw.trim() : '';

  const toRaw = context.config.get('email_to');
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

  // 配置不完整时返回 null，避免后续读取 undefined.length 报错
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
async function sendEmail(context: PluginContext, subject: string, content: string): Promise<void> {
  const emailEnabled = await context.data.get('email_enabled');
  if (emailEnabled !== true) {
    logger.warn(withPluginPrefix(PLUGIN_PREFIX, '邮件功能未启用，跳过发送'));
    return;
  }

  const emailConfig = getEmailConfig(context);
  if (!emailConfig) {
    logger.error(withPluginPrefix(PLUGIN_PREFIX, '邮件配置获取失败'));
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
    const emailsSent = (await context.data.get('emails_sent')) as number;
    const currentCount = typeof emailsSent === 'number' ? emailsSent : 0;
    await context.data.set('emails_sent', currentCount + 1);

    logger.log(withPluginPrefix(PLUGIN_PREFIX, `邮件发送成功: ${subject}`));
  } catch (error) {
    logger.error(withPluginPrefix(PLUGIN_PREFIX, `邮件发送失败: ${String(error)}`));
  }
}

const plugin: Plugin = {
  id: 'email-notification-plugin',
  name: 'Email Notification Plugin',
  version: '1.0.0',
  description: '邮件通知插件：在文章发布、评论等事件时发送邮件通知',

  // 插件初始化
  async init(context: PluginContext): Promise<void> {
    logger.log(withPluginPrefix(PLUGIN_PREFIX, '邮件通知插件正在初始化...'));

    // 验证邮件配置
    const emailConfig = getEmailConfig(context);
    if (!emailConfig) {
      logger.warn(withPluginPrefix(PLUGIN_PREFIX, '邮件配置不完整，插件将不会发送邮件'));
      await context.data.set('email_enabled', false);
    } else {
      logger.log(withPluginPrefix(PLUGIN_PREFIX, '邮件配置验证成功'));
      await context.data.set('email_enabled', true);
      await context.data.set('emails_sent', 0);
    }

    logger.log(withPluginPrefix(PLUGIN_PREFIX, '邮件通知插件初始化成功'));
  },

  // 插件销毁
  async destroy(context: PluginContext): Promise<void> {
    logger.log(withPluginPrefix(PLUGIN_PREFIX, '邮件通知插件正在销毁...'));

    const emailsSent = await context.data.get('emails_sent');
    logger.log(withPluginPrefix(PLUGIN_PREFIX, `插件已发送 ${String(emailsSent)} 封邮件`));

    // 清理数据
    await context.data.clear();
    logger.log(withPluginPrefix(PLUGIN_PREFIX, '邮件通知插件销毁完成'));
  },

  // Hook 处理器 - 正确使用 ActionCallback 类型
  hooks: {
    // 文章创建后发送通知
    'article|afterCreate': {
      type: 'action',
      priority: 10,
      handler: ((...args: unknown[]) => {
        // 兼容两参(值, 上下文)和三参(值, 元数据, 上下文)
        const [value, second, third] = args;
        const contextCandidate = third !== undefined ? third : second;

        if (value == null || typeof value !== 'object') {
          logger.warn(withPluginPrefix(PLUGIN_PREFIX, '文章创建Hook收到无效数据，跳过邮件发送'));
          return;
        }

        if (!isPluginContext(contextCandidate)) {
          logger.error(withPluginPrefix(PLUGIN_PREFIX, '插件上下文无效，跳过邮件发送'));
          return;
        }

        const article = value as ArticleData;
        const pluginContext = contextCandidate;

        const subject = `📝 新文章发布：${article.title ?? '无标题'}`;
        const content = `
          <h2>新文章发布通知</h2>
          <p><strong>标题：</strong>${article.title ?? '无标题'}</p>
          <p><strong>作者：</strong>${article.author ?? '未知'}</p>
          <p><strong>发布时间：</strong>${article.createdAt ?? '未知'}</p>
          <p><strong>内容预览：</strong></p>
          <div style="border-left: 3px solid #007cba; padding-left: 15px; margin: 10px 0;">
            ${String(article.content ?? '').substring(0, 200)}${String(article.content ?? '').length > 200 ? '...' : ''}
          </div>
          <p>请登录后台查看完整内容。</p>
        `;

        void sendEmail(pluginContext, subject, content);
      }) as ActionCallback,
    },

    // 文章更新后发送通知
    'article|afterUpdate': {
      type: 'action',
      priority: 10,
      handler: ((...args: unknown[]) => {
        // 兼容两参(值, 上下文)和三参(值, 元数据, 上下文)
        const [value, second, third] = args;
        const contextCandidate = third !== undefined ? third : second;

        if (value == null || typeof value !== 'object') {
          logger.warn(withPluginPrefix(PLUGIN_PREFIX, '文章更新Hook收到无效数据，跳过邮件发送'));
          return;
        }

        if (!isPluginContext(contextCandidate)) {
          logger.error(withPluginPrefix(PLUGIN_PREFIX, '插件上下文无效，跳过邮件发送'));
          return;
        }

        const article = value as ArticleData;
        const pluginContext = contextCandidate;

        const subject = `✏️ 文章更新：${article.title ?? '无标题'}`;
        const content = `
          <h2>文章更新通知</h2>
          <p><strong>标题：</strong>${article.title ?? '无标题'}</p>
          <p><strong>作者：</strong>${article.author ?? '未知'}</p>
          <p><strong>更新时间：</strong>${article.updatedAt ?? '未知'}</p>
          <p><strong>内容预览：</strong></p>
          <div style="border-left: 3px solid #28a745; padding-left: 15px; margin: 10px 0;">
            ${String(article.content ?? '').substring(0, 200)}${String(article.content ?? '').length > 200 ? '...' : ''}
          </div>
          <p>请登录后台查看完整内容。</p>
        `;

        void sendEmail(pluginContext, subject, content);
      }) as ActionCallback,
    },

    // 评论更新后发送通知
    'comment|afterUpdate': {
      type: 'action',
      priority: 10,
      handler: ((...args: unknown[]) => {
        // 兼容两参(值, 上下文)和三参(值, 元数据, 上下文)
        const [value, second, third] = args;
        const contextCandidate = third !== undefined ? third : second;

        if (value == null || typeof value !== 'object') {
          logger.warn(withPluginPrefix(PLUGIN_PREFIX, '评论更新Hook收到无效数据，跳过邮件发送'));
          return;
        }

        if (!isPluginContext(contextCandidate)) {
          logger.error(withPluginPrefix(PLUGIN_PREFIX, '插件上下文无效，跳过邮件发送'));
          return;
        }

        const comment = value as CommentData;
        const pluginContext = contextCandidate;

        const subject = `💬 评论系统更新通知`;
        const content = `
          <h2>评论系统更新通知</h2>
          <p><strong>文章ID：</strong>${comment.articleId ?? '未知'}</p>
          <p><strong>评论者：</strong>${comment.author ?? '匿名'}</p>
          <p><strong>邮箱：</strong>${comment.email ?? '未提供'}</p>
          <p><strong>评论内容：</strong></p>
          <div style="border-left: 3px solid #ffc107; padding-left: 15px; margin: 10px 0;">
            ${String(comment.content ?? '').substring(0, 200)}${String(comment.content ?? '').length > 200 ? '...' : ''}
          </div>
          <p>请登录后台查看详细信息。</p>
        `;

        void sendEmail(pluginContext, subject, content);
      }) as ActionCallback,
    },

    // 草稿发布后发送通知
    'draft.published': {
      type: 'action',
      priority: 10,
      handler: ((...args: unknown[]) => {
        // 兼容两参(值, 上下文)和三参(值, 元数据, 上下文)
        const [value, second, third] = args;
        const contextCandidate = third !== undefined ? third : second;

        if (value == null || typeof value !== 'object') {
          logger.warn(withPluginPrefix(PLUGIN_PREFIX, '草稿发布Hook收到无效数据，跳过邮件发送'));
          return;
        }

        if (!isPluginContext(contextCandidate)) {
          logger.error(withPluginPrefix(PLUGIN_PREFIX, '插件上下文无效，跳过邮件发送'));
          return;
        }

        const draft = value as ArticleData;
        const pluginContext = contextCandidate;

        const subject = `🚀 草稿发布：${draft.title ?? '无标题'}`;
        const content = `
          <h2>草稿发布通知</h2>
          <p><strong>标题：</strong>${draft.title ?? '无标题'}</p>
          <p><strong>作者：</strong>${draft.author ?? '未知'}</p>
          <p><strong>发布时间：</strong>${draft.createdAt ?? '未知'}</p>
          <p><strong>内容预览：</strong></p>
          <div style="border-left: 3px solid #17a2b8; padding-left: 15px; margin: 10px 0;">
            ${String(draft.content ?? '').substring(0, 200)}${String(draft.content ?? '').length > 200 ? '...' : ''}
          </div>
          <p>请登录后台查看完整内容。</p>
        `;

        void sendEmail(pluginContext, subject, content);
      }) as ActionCallback,
    },
  },
};

export default plugin;
