/* UPSTREAM: (seam 文件,无上游对应;契约即本文件导出类型)
 * SEAM: 数据层。unlockPost → POST <主题前缀>/api/unlock;主题服务端路由
 * (src/pages/api/unlock.ts)转发平台 Go 解锁端点并复用平台 markdown 渲
 * 染/消毒管线。必须用 __VANBLOG_THEME_PREFIX__(assetsPrefix 同源):caddy
 * 把裸 /api/* 全量反代 pb,主题 SSR 端点只有经 /themes/<name>/api/* 才能落
 * 回 astro(2026-09-15 e2e:裸路径 404,浏览器解锁流全断)。
 * basePath 取当前页面 URL 的挂载前缀(根空间为空串),Go 层据此把解锁
 * cookie 的 Path 限定到真实页面 URL 上——两个 URL 空间都正确。
 * 上游 fix → 不涉及本文件。
 */
export type UnlockResult = { ok: true; html: string } | { ok: false; message: string };

/** 服务端自有端点的响应形状(见 src/pages/api/unlock.ts),字段存在性运行时仍校验。 */
interface UnlockResponse {
  html?: unknown;
  message?: unknown;
}

export async function unlockPost(
  id: string,
  password: string
): Promise<UnlockResult> {
  try {
    // 当前页面 URL 的主题挂载前缀(/themes/<name> 或空串)——Go 层据此把
    // 解锁 cookie 的 Path 限定到真实页面 URL。
    const mount = typeof location !== "undefined" ? location.pathname.match(/^\/themes\/[^/]+/) : null;
    const res = await fetch(`${__VANBLOG_THEME_PREFIX__}/api/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, password, basePath: mount ? mount[0] : "" }),
    });
    const data = (await res.json().catch(() => null)) as UnlockResponse | null;
    if (res.ok) {
      return { ok: true, html: typeof data?.html === "string" ? data.html : "" };
    }
    return {
      ok: false,
      message:
        (typeof data?.message === "string" && data.message) || "密码错误！请重试！",
    };
  } catch (_) {
    return { ok: false, message: "解锁失败！" };
  }
}
