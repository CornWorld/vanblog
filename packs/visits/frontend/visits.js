/**
 * visits pack 前端 —— 全站访问量 + 当前在线（复刻原版 mereithhh Viewer）。
 *
 * 每页加载时记录一次访问（action=record），之后 30s 一次心跳（action=ping）
 * 保持会话在线；结果渲染到 `#pack-visits` 挂载点（vanblog 主题 Footer 预留），
 * 无挂载点时退化为追加到 <footer>。失败静默。
 */
(() => {
  const SESSION_KEY = "vanblog-visits-session";
  const API = "/api/packs/visits";
  const HEARTBEAT_MS = 30_000;

  let sessionId;
  try {
    sessionId = localStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : "s" + Date.now() + Math.random().toString(36).slice(2);
      localStorage.setItem(SESSION_KEY, sessionId);
    }
  } catch {
    sessionId = "s" + Date.now();
  }

  function render(visited, online) {
    let el = document.getElementById("pack-visits");
    if (!el) {
      const footer = document.querySelector("footer");
      if (!footer) return;
      el = document.createElement("div");
      el.id = "pack-visits";
      el.className = "mt-1";
      footer.appendChild(el);
    }
    el.textContent = "";
    const span = document.createElement("span");
    span.className = "select-none text-sm";
    span.textContent = `👀 当前在线 ${online} · 📊 总访问 ${visited}`;
    el.appendChild(span);
  }

  async function call(action) {
    try {
      const res = await fetch(
        `${API}?action=${encodeURIComponent(action)}&session=${encodeURIComponent(sessionId)}`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data && typeof data.visited === "number") render(data.visited, data.online || 0);
    } catch {
      /* network/parse errors: silent */
    }
  }

  if (document.readyState === "complete") call("record");
  else window.addEventListener("load", () => call("record"));
  setInterval(() => call("ping"), HEARTBEAT_MS);
})();
