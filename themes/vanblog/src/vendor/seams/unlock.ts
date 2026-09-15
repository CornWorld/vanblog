/* UPSTREAM: (seam 文件,无上游对应;契约即本文件导出类型)
 * SEAM: 数据层。unlockPost → POST <base>/api/unlock;主题服务端路由
 * (src/pages/api/unlock.ts)转发平台 Go 解锁端点并复用平台 markdown 渲
 * 染/消毒管线。base 前缀必须带:caddy 把裸 /api/* 全量反代 pb,主题 SSR
 * 端点只有经 /themes/<name>/api/* 才能落回 astro(2026-09-15 e2e:裸路
 * 径 404,浏览器解锁流全断)。上游 fix → 不涉及本文件。
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
    const res = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, password }),
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
