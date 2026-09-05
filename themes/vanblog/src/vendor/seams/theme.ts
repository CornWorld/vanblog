/* UPSTREAM: packages/website/utils/theme.ts + utils/themeContext.ts@4b488500be8100b19772ec00d8315f343a6ac21e
 * SEAM: ThemeContext 砍掉(多 island 无共享 Provider)→ 模块级单例 store +
 * useSyncExternalStore;主题态仍落 localStorage("theme",与上游同 key,上游 fix 兼容)
 * + html.dark + 平台 darkmodechange 事件(sdk/src/theme.ts applyPalette 同款)。
 * 与上游的刻意差异:
 *   1) 10s auto 轮询计时器归并入 seam(全局单例,避免多 island 各自起 timer);
 *   2) applyTheme 额外派发平台 `darkmodechange`(palette 联动,见 sdk theme.ts);
 *   3) switchThemeMode:用户主动切换入口,先撤销显式 palette 锁(SDK clearPalette);
 *   4) 监听 darkmodechange 同步 realTheme(调色盘强制明暗时图标保持一致)。
 * 其余(getAutoTheme 18-8 规则/initTheme/applyTheme 类切换)上游原样。
 *
 * ── palette 共存约定(平台原子调色盘 × 上游三态)───────────────────────────
 * 显式 palette 锁在位时,FOUC 脚本按 palette type 上色;用户点 ThemeButton 即经
 * switchThemeMode 撤销锁、三态接管;点调色盘则反之。首帧到 island 挂载之间的
 * 最终校正由 ThemeButton useLayoutEffect 完成(上游同款)。最后点击者生效。
 * 上游 fix → 对本文件 apply patch。
 */
import { useSyncExternalStore } from "react";
import { clearPalette } from "@vanblog/sdk/browser";

/** 计划契约类型:三态用户偏好。 */
export type ThemeMode = "light" | "dark" | "auto";
/** 上游 RealThemeType:auto 解析后的实际主题。 */
export type RealTheme = "light" | "dark" | "auto-light" | "auto-dark";

// ── 上游 utils/theme.ts 原样 ─────────────────────────────────────────────

export const initTheme = (): ThemeMode => {
  if (typeof localStorage === "undefined") {
    return "auto";
  }

  // 2种情况： 1. 自动。 2.手动
  if (!("theme" in localStorage) || localStorage.theme == "auto") {
    return "auto";
  }

  if (localStorage.theme === "dark") {
    return "dark";
  }

  return "light";
};

export const getAutoTheme = (): RealTheme => {
  const hour = new Date().getHours();
  const isNight = hour > 18 || hour < 8;

  if (typeof window === "undefined") {
    return isNight ? "auto-dark" : "auto-light";
  }

  if (isNight || window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "auto-dark";
  }

  return "auto-light";
};

export const getTheme = (theme: ThemeMode): RealTheme =>
  theme == "auto" ? getAutoTheme() : theme;

export const applyTheme = (theme: RealTheme, source: string, disableLog = false) => {
  if (theme.includes("light")) {
    document.documentElement.classList.add("light");
    document.documentElement.classList.remove("dark");
    if (!disableLog) {
      console.log(`[Apply Theme][${source}] ${theme}`);
    }
  } else {
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
    if (!disableLog) {
      console.log(`[Apply Theme][${source}] ${theme}`);
    }
  }
  // 平台联动:palette/评论组件监听此事件(与 sdk applyPalette 一致)
  document.documentElement.dispatchEvent(
    new CustomEvent("darkmodechange", { detail: { dark: theme.includes("dark") } })
  );
  realTheme = theme;
  listeners.forEach((l) => l());
};

// ── 模块级单例 store(上游 ThemeContext.Provider 替身) ─────────────────────

let realTheme: RealTheme = "auto-light";
if (typeof document !== "undefined") {
  realTheme = document.documentElement.classList.contains("dark")
    ? "auto-dark"
    : "auto-light";
}
const listeners = new Set<() => void>();
let autoTimer: ReturnType<typeof setInterval> | null = null;

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function stopAutoTimer() {
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
  }
}

function startAutoTimer() {
  stopAutoTimer();
  autoTimer = setInterval(() => {
    applyTheme(getTheme("auto"), "autoThemeTimer", true);
  }, 10000);
}

/** 计划契约:读三态偏好。 */
export function getThemeMode(): ThemeMode {
  if (typeof localStorage === "undefined") return "auto";
  const t = localStorage.getItem("theme");
  return t === "dark" || t === "light" ? t : "auto";
}

/** 计划契约:三态写入(localStorage + html.dark + darkmodechange + auto 计时器)。 */
export function setThemeMode(m: ThemeMode): void {
  stopAutoTimer();
  localStorage.setItem("theme", m);
  // 设置真实的主题，然后把真实的主题搞到 state 里。(上游 setTheme 原样,计时器并入)
  const real = getTheme(m);
  applyTheme(real, "setTheme", true);
  if (real.includes("auto")) {
    startAutoTimer();
  }
}

/**
 * 用户主动切换(ThemeButton 循环)入口:先撤销显式 palette 锁(SDK clearPalette,
 * 色彩回落站点默认 palette),再应用三态。初始化路径不要用本函数 — 会误清
 * 用户的调色盘偏好;两个 UI 的优先级约定见文件头「palette 共存约定」。
 */
export function switchThemeMode(m: ThemeMode): void {
  clearPalette();
  setThemeMode(m);
}

/** 计划契约:React hook,返回 [三态模式, setter](上游 ThemeContext 替身)。 */
export function useThemeMode(): [ThemeMode, (m: ThemeMode) => void] {
  const theme = useSyncExternalStore(
    subscribe,
    () => realTheme,
    () => "auto-light" as RealTheme
  );
  const mode: ThemeMode =
    theme === "auto-light" || theme === "auto-dark" ? "auto" : theme;
  return [mode, setThemeMode];
}

/** 上游 Core 直接消费实际主题(auto-light/auto-dark 参与图标与文案)。 */
export function useRealTheme(): RealTheme {
  return useSyncExternalStore(
    subscribe,
    () => realTheme,
    () => "auto-light" as RealTheme
  );
}

// applyPalette(SDK)会设置 html.dark 并派发 darkmodechange;监听同步 realTheme,
// 保证 ThemeButton 图标与 palette 强制明暗一致。applyTheme 自己也派发同一事件,
// 此时 real===realTheme,不会循环。
if (typeof document !== "undefined") {
  document.documentElement.addEventListener("darkmodechange", (e) => {
    const detail = (e as CustomEvent<{ dark?: boolean }>).detail;
    const dark =
      detail?.dark ?? document.documentElement.classList.contains("dark");
    const real: RealTheme = dark ? "auto-dark" : "auto-light";
    if (real !== realTheme) {
      realTheme = real;
      listeners.forEach((l) => l());
    }
  });
}
