/* UPSTREAM: (无上游对应 — 平台原子调色盘特性,自 themes/vanblog/src/components/Nav.astro
 *          的调色盘面板移植为 React;上游 fix → 不涉及本文件)
 * SEAM: 平台 palette 模型 UI。getPalette/fetchPalettes/applyPalette/SYSTEM_PALETTE
 * 均来自 @vanblog/sdk/browser(SDK 负责 localStorage/html.dark/palette.css/渐进过渡)。
 * 与 vendor ThemeButton 的交互:applyPalette 派发 darkmodechange,seams/theme 监听
 * 该事件同步内部 realTheme(见 seams/theme.ts 头注);用户点 ThemeButton 三态切换时
 * 经 switchThemeMode 撤销显式 palette 锁。两个 UI 最后点击者生效。
 */
import { useEffect, useRef, useState } from "react";
import {
  getPalette,
  fetchPalettes,
  applyPalette,
  SYSTEM_PALETTE,
} from "@vanblog/sdk/browser";
import type { PaletteMeta } from "@vanblog/sdk/browser";

export default function PalettePicker(props: { sitePalette: string }) {
  const [open, setOpen] = useState(false);
  const [palettes, setPalettes] = useState<PaletteMeta[]>([]);
  const [userPref, setUserPref] = useState<string | null>(null);
  const [dark, setDark] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setUserPref(getPalette());
    const onDark = (e: Event) => {
      const detail = (e as CustomEvent<{ dark?: boolean }>).detail;
      setDark(detail?.dark ?? document.documentElement.classList.contains("dark"));
    };
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.documentElement.addEventListener("darkmodechange", onDark);
    document.addEventListener("click", onDocClick);
    return () => {
      document.documentElement.removeEventListener("darkmodechange", onDark);
      document.removeEventListener("click", onDocClick);
    };
  }, []);

  const openPanel = () => {
    setOpen(true);
    setUserPref(getPalette());
    fetchPalettes().then(setPalettes);
  };
  const select = (name: string) => {
    // 委托 SDK:持久化 + html.dark + palette.css link + 渐进切换
    applyPalette(name, { sitePalette: props.sitePalette || null, palettes });
    setUserPref(getPalette());
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative flex items-center">
      <button
        type="button"
        aria-label="切换调色盘"
        title="切换调色盘"
        data-site-palette={props.sitePalette}
        className="flex items-center cursor-pointer hover:scale-125 transform transition-all mx-4 sm:ml-2 lg:ml-6 text-[var(--text-muted)]"
        onClick={(e) => {
          e.preventDefault();
          setOpen(!open);
          if (!open) openPanel();
        }}
      >
        <svg
          viewBox="0 0 1024 1024"
          width="20"
          height="20"
          fill="currentColor"
          aria-hidden="true"
          style={{ display: dark ? "none" : "block" }}
        >
          <path d="M952 552h-80a40 40 0 0 1 0-80h80a40 40 0 0 1 0 80zM801.88 280.08a41 41 0 0 1-57.96-57.96l57.96-58a41.04 41.04 0 0 1 58 58l-58 57.96zM512 752a240 240 0 1 1 0-480 240 240 0 0 1 0 480zm0-560a40 40 0 0 1-40-40V72a40 40 0 0 1 80 0v80a40 40 0 0 1-40 40zm-289.88 88.08-58-57.96a41.04 41.04 0 0 1 58-58l57.96 58a41 41 0 0 1-57.96 57.96zM192 512a40 40 0 0 1-40 40H72a40 40 0 0 1 0-80h80a40 40 0 0 1 40 40zm30.12 231.92a41 41 0 0 1 57.96 57.96l-57.96 58a41.04 41.04 0 0 1-58-58l58-57.96zM512 832a40 40 0 0 1 40 40v80a40 40 0 0 1-80 0v-80a40 40 0 0 1 40-40zm289.88-88.08 58 57.96a41.04 41.04 0 0 1-58 58l-57.96-58a41 41 0 0 1 57.96-57.96z"></path>
        </svg>
        <svg
          viewBox="0 0 1024 1024"
          width="20"
          height="20"
          fill="currentColor"
          aria-hidden="true"
          style={{ display: dark ? "block" : "none" }}
        >
          <path d="M524.8 938.667h-4.267a439.893 439.893 0 0 1-313.173-134.4 446.293 446.293 0 0 1-11.093-597.334A432.213 432.213 0 0 1 366.933 90.027a42.667 42.667 0 0 1 45.227 9.386 42.667 42.667 0 0 1 10.24 42.667 358.4 358.4 0 0 0 82.773 375.893 361.387 361.387 0 0 0 376.747 82.774 42.667 42.667 0 0 1 54.187 55.04 433.493 433.493 0 0 1-99.84 154.88 438.613 438.613 0 0 1-311.467 128z"></path>
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-[var(--border)] bg-[var(--surface)] card-shadow p-2 z-50">
          <p className="px-2 py-1 text-xs text-[var(--text-muted)]">调色盘（选它即定明暗 + 配色）</p>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              className={`px-2 py-1 text-left rounded hover:bg-[var(--border)] ${
                !userPref ? "text-[var(--accent)] font-medium" : "text-[var(--text)]"
              }`}
              onClick={() => select(SYSTEM_PALETTE)}
            >
              跟随系统
            </button>
            {palettes.map((p) => (
              <button
                type="button"
                key={p.name}
                className={`px-2 py-1 text-left rounded hover:bg-[var(--border)] ${
                  p.name === userPref ? "text-[var(--accent)] font-medium" : "text-[var(--text)]"
                }`}
                onClick={() => select(p.name)}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
