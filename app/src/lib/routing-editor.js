// Routing editor — extracted from routing.astro to keep the template
// agent-safe (HTML/CSS only). All client-side logic: CRUD, validation,
// health banner, audits feed, Caddy config preview.
export function initRoutingEditor({ TYPE_OPTIONS }) {
  const pb = self.vanblog?.pb;
  const tbody = document.getElementById("rules-body");
  const status = document.getElementById("save-status");
  const allowlistEl = document.getElementById("allowlist");

  function escapeHtml(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[c])
    );
  }

  function formatAuditTime(raw) {
    const d = new Date(String(raw).replace(" ", "T"));
    if (isNaN(d.getTime())) return raw;
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return "刚刚";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
    return d.toLocaleString("zh-CN", { hour12: false });
  }

  function getAllowlist() {
    return allowlistEl.value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function readRow(tr) {
    const headersRaw = tr.querySelector(".f-headers").value.trim();
    let headers = undefined;
    if (headersRaw) {
      try {
        headers = JSON.parse(headersRaw);
      } catch {
        throw new Error("Headers 不是合法 JSON：" + headersRaw);
      }
    }
    return {
      id: tr.querySelector(".f-id").value.trim(),
      type: tr.querySelector(".f-type").value,
      from: tr.querySelector(".f-from").value.trim(),
      to: tr.querySelector(".f-to").value.trim(),
      code: Number(tr.querySelector(".f-code").value) || undefined,
      headers,
      stripPathPrefix: tr.querySelector(".f-strip").value.trim() || undefined,
    };
  }

  // ── health banner ──

  async function refreshStatus() {
    let s;
    try {
      s = await pb.vanblog.routing.status();
    } catch (err) {
      // Status is best-effort, but a silent swallow hides a broken routing API.
      console.warn("[routing] refreshStatus failed:", err);
      return;
    }
    const banner = document.getElementById("health-banner");
    const unhealthy = s.caddyLastError || s.caddy_reachable === false;
    if (!unhealthy) {
      if (banner) banner.remove();
      return;
    }
    const isError = !!s.caddyLastError;
    const cls = isError
      ? "bg-red-50 border-red-300 text-red-800 dark:bg-red-950 dark:border-red-700 dark:text-red-200"
      : "bg-yellow-50 border-yellow-300 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-700 dark:text-yellow-200";
    const html = `
      ${
        s.caddyLastError
          ? `<p><strong>上次应用失败：</strong><code class="font-mono text-xs break-all">${escapeHtml(
              s.caddyLastError
            )}</code></p>`
          : ""
      }
      ${
        s.caddy_reachable === false
          ? "<p><strong>Caddy 不可达。</strong>路由保存后不会生效，请检查 Caddy 进程或 <code>VANBLOG_SKIP_CADDY_SYNC</code> 设置。</p>"
          : ""
      }
      <p class="text-xs mt-1 opacity-75">DB 中有 ${
        s.pending_rules ?? 0
      } 条规则，点击「立即应用」可重试同步到 Caddy。</p>`;
    if (banner) {
      banner.className = `mb-4 px-4 py-3 rounded border text-sm ${cls}`;
      banner.innerHTML = html;
    } else {
      const nb = document.createElement("div");
      nb.id = "health-banner";
      nb.className = `mb-4 px-4 py-3 rounded border text-sm ${cls}`;
      nb.innerHTML = html;
      document.querySelector("h1 + p")?.after(nb);
    }
  }

  // ── audit feed ──

  async function refreshAudits() {
    let items;
    try {
      items = (await pb.vanblog.routing.audits()).items || [];
    } catch (err) {
      // Audits are a nice-to-have panel; don't crash, but surface the failure.
      console.warn("[routing] refreshAudits failed:", err);
      return;
    }
    const panel = document.getElementById("audit-panel");
    if (!panel) return;
    const list = panel.querySelector("ul");
    if (!list) return;
    if (items.length === 0) {
      panel.remove();
      return;
    }
    const summary = panel.querySelector("summary");
    if (summary)
      summary.textContent = `最近变更（${items.length} 条${
        items.length >= 10 ? "，仅显示最近 10 条" : ""
      }）`;
    list.innerHTML = items
      .map((a) => {
        const time = formatAuditTime(a.created);
        const okBadge =
          a.result === "failure"
            ? '<span class="w-14 shrink-0 text-red-600 dark:text-red-400">✗ 失败</span>'
            : '<span class="w-14 shrink-0 text-green-700 dark:text-green-400">✓ 成功</span>';
        const actor = escapeHtml(a.actorName || "system/agent");
        const actionLabel =
          a.action === "routing.replace" ? "替换规则" : escapeHtml(a.action);
        const rollback = a.detail?.rollback
          ? '<span class="text-yellow-700 dark:text-yellow-400">（已回滚）</span>'
          : "";
        const before = Array.isArray(a.detail?.before)
          ? a.detail.before.length
          : "?";
        const after = Array.isArray(a.detail?.after)
          ? a.detail.after.length
          : "?";
        const delta =
          typeof before === "number" && typeof after === "number"
            ? `<span class="text-[var(--color-text-muted)]"> [${before} → ${after} 条]</span>`
            : "";
        const err = a.detail?.caddyError
          ? `<span class="text-red-600 dark:text-red-400">：${escapeHtml(
              String(a.detail.caddyError)
            )}</span>`
          : "";
        return `<li class="flex gap-2 items-baseline">
        <span class="text-[var(--color-text-muted)] w-32 shrink-0">${time}</span>
        ${okBadge}
        <span class="w-32 shrink-0 text-[var(--color-text-muted)]">${actor}</span>
        <span class="flex-1 break-all">${actionLabel} ${rollback} ${delta} ${err}</span></li>`;
      })
      .join("");
  }

  // ── row CRUD ──

  function newRow() {
    const tr = document.createElement("tr");
    tr.className = "border-b border-[var(--color-border)] align-top";
    tr.innerHTML = `<td><input class="f-id w-full px-1 py-0.5 font-mono text-xs" placeholder="rule-id"/></td>
      <td><select class="f-type px-1 py-0.5">${TYPE_OPTIONS.map(
        (t) => `<option value="${t}">${t}</option>`
      ).join("")}</select></td>
      <td><input class="f-from w-full px-1 py-0.5 font-mono text-xs" placeholder="/docs/*"/></td>
      <td><input class="f-to w-full px-1 py-0.5 font-mono text-xs" placeholder="按类型变化"/></td>
      <td><input class="f-code w-full px-1 py-0.5" type="number" placeholder="301"/></td>
      <td><textarea class="f-headers w-full px-1 py-0.5 font-mono text-xs resize-y min-h-[28px]" rows="1" placeholder='{"X-Key":"v"}'></textarea></td>
      <td><input class="f-strip w-full px-1 py-0.5 font-mono text-xs" placeholder="/prefix"/></td>
      <td class="flex gap-2"><button type="button" class="btn-test text-xs">试一下</button><button type="button" class="btn-del text-red-600 text-xs">删除</button></td>`;
    bindRow(tr);
    tbody.appendChild(tr);
  }

  function bindRow(tr) {
    tr.querySelector(".btn-del").addEventListener("click", () => tr.remove());
    const headersEl = tr.querySelector(".f-headers");
    headersEl?.addEventListener("blur", () => {
      const raw = headersEl.value.trim();
      headersEl.classList.remove("border-red-500", "border-green-500");
      if (!raw) return;
      try {
        JSON.parse(raw);
        headersEl.classList.add("border-green-500");
      } catch (e) {
        headersEl.classList.add("border-red-500");
        headersEl.title = "Headers 不是合法 JSON：" + e.message;
      }
    });
    tr.querySelector(".btn-test").addEventListener("click", async () => {
      let rule;
      try {
        rule = readRow(tr);
      } catch (e) {
        alert(e.message);
        return;
      }
      status.textContent = "校验中…";
      try {
        const r = await pb.vanblog.routing.validate(rule, getAllowlist());
        status.textContent = r.ok
          ? `✓ ${rule.id || "(新规则)"} 校验通过`
          : `✗ ${rule.id || "(新规则)"}：${r.error || "未知错误"}`;
      } catch (e) {
        status.textContent = "校验请求失败：" + e.message;
      }
    });
  }

  document.querySelectorAll("#rules-body tr").forEach(bindRow);
  document.getElementById("btn-add").addEventListener("click", newRow);

  // ── save / apply ──

  document.getElementById("btn-save").addEventListener("click", async () => {
    if (!pb) return alert("未登录");
    const rules = [];
    try {
      for (const tr of document.querySelectorAll("#rules-body tr"))
        rules.push(readRow(tr));
    } catch (e) {
      alert(e.message);
      return;
    }
    status.textContent = "保存中（最长可能 30s）…";
    try {
      const r = await pb.vanblog.routing.replace(rules, getAllowlist());
      if (r.applied) status.textContent = "✓ 已保存并应用到 Caddy";
      else if (r.rolled_back) {
        status.textContent = "✗ 已回滚：" + (r.error || "未知错误");
        alert("保存失败，已恢复到之前的规则：\n" + (r.error || ""));
      } else if (r.restart_needed)
        status.textContent = '已保存，重启 vanblog 后生效（或点"立即应用"）';
      else if (r.error) {
        status.textContent = "✗ 保存失败：" + r.error;
        alert("保存失败：" + r.error);
      } else status.textContent = "未应用：" + JSON.stringify(r);
    } catch (e) {
      status.textContent = "✗ 保存被拒绝：" + e.message;
      alert("保存被拒绝：\n" + e.message);
    }
    refreshStatus();
    refreshAudits();
  });

  document.getElementById("btn-apply").addEventListener("click", async () => {
    if (!pb) return alert("未登录");
    status.textContent = "应用中（最长可能 30s）…";
    try {
      const r = await pb.vanblog.routing.apply();
      if (r.applied) status.textContent = "✓ 已应用到运行中的 Caddy";
      else if (r.error) {
        status.textContent = "✗ 应用失败：" + r.error;
        alert("应用失败：" + r.error);
      } else status.textContent = "未应用：" + JSON.stringify(r);
    } catch (e) {
      status.textContent = "应用请求失败：" + e.message;
      alert("应用请求失败：" + e.message);
    }
    refreshStatus();
  });

  // ── Caddy config preview ──

  const renderPanel = document.getElementById("render-panel");
  const renderOutput = document.getElementById("render-output");
  const renderError = document.getElementById("render-error");
  const renderStatus = document.getElementById("render-status");
  let renderCache = null,
    renderFetched = false;

  function renderSelectedLayer() {
    if (!renderCache) return;
    const layer =
      document.querySelector('input[name="render-layer"]:checked')?.value ||
      "user";
    const data =
      layer === "full" ? renderCache.fullConfig : renderCache.userRoutes;
    if (data === null || data === undefined) {
      renderOutput.textContent =
        layer === "full" ? "(完整 config 不可用)" : "(无规则)";
      return;
    }
    renderOutput.textContent = JSON.stringify(data, null, 2);
  }

  async function loadRender(force) {
    if (renderFetched && !force) {
      renderSelectedLayer();
      return;
    }
    renderStatus.textContent = "加载中…";
    renderError.classList.add("hidden");
    try {
      const r = await pb.vanblog.routing.render();
      renderCache = r;
      renderFetched = true;
      renderStatus.textContent = "";
      if (r.error) {
        renderError.textContent = "校验失败：" + r.error;
        renderError.classList.remove("hidden");
      }
      renderOutput.textContent =
        !r.userRoutes || r.userRoutes.length === 0
          ? "（无用户规则，或规则校验未通过）"
          : "";
      if (r.userRoutes?.length) renderSelectedLayer();
    } catch (e) {
      renderStatus.textContent = "";
      renderError.textContent = "加载失败：" + e.message;
      renderError.classList.remove("hidden");
    }
  }

  let renderFirstOpen = true;
  renderPanel?.addEventListener("toggle", () => {
    if (renderPanel.open && renderFirstOpen) {
      renderFirstOpen = false;
      loadRender(true);
    }
  });
  document
    .getElementById("btn-render-refresh")
    ?.addEventListener("click", () => loadRender(true));
  document
    .querySelectorAll('input[name="render-layer"]')
    .forEach((el) => el.addEventListener("change", renderSelectedLayer));
}
