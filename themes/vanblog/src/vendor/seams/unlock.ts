/* UPSTREAM: (seam 文件,无上游对应 — 契约见 .snow/plan/vendor-upstream-islands-parity.md)
 * SEAM: 数据层。unlockPost → POST /api/unlock;服务端(src/pages/api/unlock.ts)复用
 * 文章页同款密码校验 + 平台 markdown 渲染/消毒管线。上游 fix → 不涉及本文件。
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
    const res = await fetch("/api/unlock", {
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
