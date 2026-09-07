// POST /api/unlock  {id, password} → 200 {html} / 401 {message} / 404 {message} / 400 {message}
//
// 计划契约(.snow/plan/vendor-upstream-islands-parity.md):vendor UnLockCard 走 AJAX
// 解锁,不再整页表单刷新。本端点**复用** posts/[id].astro 的校验逻辑与平台渲染管线
// (normalizeMathDelimiters → renderMarkdown → sanitizeHtml),不重新发明。
// 成功时同时下发与页面解锁一致的 path 限定 cookie,刷新/分享后保持解锁态。
export const prerender = false;

import type { APIRoute } from 'astro';
import { renderMarkdown } from '@vanblog/base/lib/markdown/renderer';
import { normalizeMathDelimiters } from '@vanblog/base/lib/markdown/normalizeMathDelimiters';
import type { Post } from '@vanblog/sdk';
import { sanitizeHtml } from '../../lib/sanitizeHtml';

const json = (data: unknown, status: number) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ locals, request, cookies }) => {
  let body: { id?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return json({ message: '无效请求' }, 400);
  }
  const id = String(body.id ?? '');
  const password = String(body.password ?? '');
  if (!id || !password) return json({ message: '输入不能为空！' }, 400);

  const pb = locals.pb;
  let raw: Post;
  try {
    raw = await pb.collection('posts').getOne<Post>(id);
  } catch {
    return json({ message: '文章不存在' }, 404);
  }
  if (!raw.password || raw.password !== password) {
    return json({ message: '密码错误！请重试！' }, 401);
  }

  const content = normalizeMathDelimiters(raw.content || '');
  const { code } = await renderMarkdown(content);

  // 与 posts/[id].astro POST 解锁一致的 cookie 语义(path 限定,7 天)。
  // BASE_URL 兼容:生产为 '/',多主题 dev 挂在 /themes/<name>/ 下,cookie path
  // 必须与实际页面路径一致才能随请求回传。
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  cookies.set(`vb-unlock-${id}`, 'true', {
    path: `${basePath}/post/${id}`,
    maxAge: 86400 * 7,
    sameSite: 'lax',
  });

  return json({ html: sanitizeHtml(code) }, 200);
};
