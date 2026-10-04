/* UPSTREAM: (平台文件,无上游对应)
 * SEAM: 平台 palette 模型 UI。getPalette/fetchPalettes/applyPalette/SYSTEM_PALETTE
 * 均来自 @vanblog/sdk/browser(SDK 负责 localStorage/html.dark/palette.css/渐进过渡)。
 * 与 vendor ThemeButton 的交互:applyPalette 派发 darkmodechange,seams/theme 监听
 * 该事件同步内部 realTheme(见 seams/theme.ts 头注);用户点 ThemeButton 三态切换时
 * 经 switchThemeMode 撤销显式 palette 锁。两个 UI 最后点击者生效。
 * 偏离(2026-10-04):按钮图标从 sun/moon 双 SVG(逐字复制 ThemeButton,与明暗
 * 切换按钮无法区分)改为单一调色盘图标;不再持有 dark state。
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
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUserPref(getPalette());
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => {
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
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="currentColor"
          aria-hidden="true"
        >
          {/* Material Icons「palette」:与旁边明暗切换的 sun/moon 语义可区分 */}
          <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"></path>
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
