/**
 * online pack 前端 —— 当前在线（纯展示，非热点）。
 *
 * 与文章浏览计数解耦：计数走平台 Go 层（theme 在文章页触发
 * POST /api/vanblog/visits/record），本脚本只做在线心跳——
 * 每 30s 一次 GET /api/packs/online 登记会话并刷新在线人数，
 * 渲染到 `#pack-online` 挂载点（无挂载点时追加 <footer>）。失败静默。
 */
(() => {
  const SESSION_KEY = "vanblog-online-session";
  const API = "/api/packs/online";
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

  function render(online) {
    let el = document.getElementById("pack-online");
    if (!el) {
      const footer = document.querySelector("footer");
      if (!footer) return;
      el = document.createElement("div");
      el.id = "pack-online";
      el.className = "mt-1";
      footer.appendChild(el);
    }
    el.textContent = "";
    const span = document.createElement("span");
    span.className = "select-none text-sm";
    span.textContent = `👀 当前在线 ${online}`;
    el.appendChild(span);
  }

  async function call() {
    try {
      const res = await fetch(
        `${API}?session=${encodeURIComponent(sessionId)}`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data && typeof data.online === "number") render(data.online);
    } catch {
      /* network/parse errors: silent */
    }
  }

  call();
  setInterval(call, HEARTBEAT_MS);
})();
