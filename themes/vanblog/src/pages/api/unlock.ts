// POST /api/unlock  {id, password} → 200 {html} / 401 {message} / 404 {message} / 400 {message} / 429 {message}
//
// 验密与解锁凭证全部在平台 Go 层 /api/vanblog/posts/{id}/unlock 完成
// (vault internal/article/unlock.go):服务端读行比对密码(匿名 API 已遮蔽
// content/password,客户端无从自验),成功后签发 HMAC 签名解锁 cookie
// (path 限定到 /post/<id>)。本端点只做:转发、平台渲染管线
// (normalizeMathDelimiters → renderMarkdown → sanitizeHtml)、把 Go 下发的
// Set-Cookie 中继给浏览器。
export const prerender = false;

import type { APIRoute } from 'astro';
import { renderMarkdown } from '@vanblog/base/lib/markdown/renderer';
import { normalizeMathDelimiters } from '@vanblog/base/lib/markdown/normalizeMathDelimiters';
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
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  const r = await fetch(`${pb.baseURL}/api/vanblog/posts/${id}/unlock`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: request.headers.get('cookie') || '',
    },
    body: JSON.stringify({ password, basePath }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => null);
    return json(
      { message: err?.message || '密码错误！请重试！' },
      r.status === 404 ? 404 : r.status === 429 ? 429 : 401,
    );
  }
  const { content } = await r.json();

  // 中继 Go 层 Set-Cookie(vb-unlock-<id> = HMAC 签名 token),浏览器刷新/
  // 分享后凭 cookie 免密重看;cookie 的 path 已由 Go 按 /post/<id> 限定。
  for (const raw of r.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(';');
    const eq = pair.indexOf('=');
    if (eq > 0) {
      cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim(), {
        path: `${basePath}/post/${id}`,
        maxAge: 86400 * 7,
        httpOnly: true,
        sameSite: 'lax',
      });
    }
  }

  const { code } = await renderMarkdown(normalizeMathDelimiters(content || ''));
  return json({ html: sanitizeHtml(code) }, 200);
};
