/* UPSTREAM: packages/website/components/ThemeButton/index.tsx@4b488500be8100b19772ec00d8315f343a6ac21e
 * UPSTREAM: packages/website/components/ThemeButton/core.tsx@4b488500be8100b19772ec00d8315f343a6ac21e
 * SEAM: ThemeContext → seams/theme.ts(模块级 store + useRealTheme)。
 * 与上游差异:计时器/持久化并入 seam(上游 core 内联的 setTheme/clearTimer/setTimer),
 * light→dark→auto 切换循环、auto 文案、图标、hasInit 初始化均原样。
 * 上游 fix → 对本文件 apply patch。
 * 偏离(2026-10-04,修「切页图标闪 / palette 与三态错配」):
 *  1) 三枚图标常驻 DOM,可见性由 html[data-theme-mode] 的 CSS 规则驱动
 *     (FOUC 脚本在首帧前写好该属性)→ 删掉 showChild 水合闸与 SSR 占位,
 *     图标在整页导航间不再闪烁;React state 只驱动点击循环逻辑。
 *  2) 初始化遇 palette 锁(getPalette() 非空)时不再 setThemeMode 覆盖
 *     html 明暗——palette 是最后一次显式选择,锁生效期间只同步 store。
 *  3) handleSwitch 经 switchThemeMode(m, sitePalette) 把 palette.css 换回
 *     站点默认配色,避免会话内配色与明暗类错配。
 */
import { useLayoutEffect, useRef } from "react";
import { getPalette } from "@vanblog/sdk/browser";
import { initTheme, setThemeMode, switchThemeMode, useRealTheme } from "./seams/theme";

export default function ThemeButton(props: {
  defaultTheme: "auto" | "dark" | "light";
  /** 站点默认 palette;切三态撤销 palette 锁后用它恢复配色 css(见头注 #3)。 */
  sitePalette?: string;
}) {
  const { current } = useRef({ hasInit: false });
  const theme = useRealTheme();

  useLayoutEffect(() => {
    if (!current.hasInit) {
      current.hasInit = true;
      if (getPalette()) {
        // palette 锁生效中:html 明暗由 FOUC 脚本按 palette type 决定,
        // store 已按 html.dark 初始化,这里不动 class(见头注 #2)。
        return;
      }
      if (!localStorage.getItem("theme")) {
        // 第一次用默认的
        setThemeMode(props.defaultTheme);
      } else {
        const iTheme = initTheme();
        setThemeMode(iTheme);
      }
    }
  }, [current, props, theme]);

  const handleSwitch = () => {
    if (theme == "light") {
      switchThemeMode("dark", props.sitePalette);
    } else if (theme == "dark") {
      switchThemeMode("auto", props.sitePalette);
    } else {
      switchThemeMode("light", props.sitePalette);
    }
  };
  return (
    <div
      className="flex items-center cursor-pointer hover:scale-125 transform transition-all mr-4 ml-4 sm:ml-2 lg:ml-6   "
      onClick={handleSwitch}
    >
      <div className="tb-icon tb-icon-light dark:text-dark " style={{ height: 20 }} title="亮色模式">
        <svg
          className="fill-gray-600"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1024 1024"
          fill="currentColor"
          aria-label="light icon"
          width={20}
          height={20}
        >
          <path d="M952 552h-80a40 40 0 0 1 0-80h80a40 40 0 0 1 0 80zM801.88 280.08a41 41 0 0 1-57.96-57.96l57.96-58a41.04 41.04 0 0 1 58 58l-58 57.96zM512 752a240 240 0 1 1 0-480 240 240 0 0 1 0 480zm0-560a40 40 0 0 1-40-40V72a40 40 0 0 1 80 0v80a40 40 0 0 1-40 40zm-289.88 88.08-58-57.96a41.04 41.04 0 0 1 58-58l57.96 58a41 41 0 0 1-57.96 57.96zM192 512a40 40 0 0 1-40 40H72a40 40 0 0 1 0-80h80a40 40 0 0 1 40 40zm30.12 231.92a41 41 0 0 1 57.96 57.96l-57.96 58a41.04 41.04 0 0 1-58-58l58-57.96zM512 832a40 40 0 0 1 40 40v80a40 40 0 0 1-80 0v-80a40 40 0 0 1 40-40zm289.88-88.08 58 57.96a41.04 41.04 0 0 1-58 58l-57.96-58a41 41 0 0 1 57.96-57.96z"></path>
        </svg>
      </div>
      <div
        className="tb-icon tb-icon-dark dark:text-dark fill-gray-600"
        style={{ height: 20 }}
        title="暗色模式"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1024 1024"
          fill="currentColor"
          aria-label="dark icon"
          width={20}
          height={20}
        >
          <path d="M524.8 938.667h-4.267a439.893 439.893 0 0 1-313.173-134.4 446.293 446.293 0 0 1-11.093-597.334A432.213 432.213 0 0 1 366.933 90.027a42.667 42.667 0 0 1 45.227 9.386 42.667 42.667 0 0 1 10.24 42.667 358.4 358.4 0 0 0 82.773 375.893 361.387 361.387 0 0 0 376.747 82.774 42.667 42.667 0 0 1 54.187 55.04 433.493 433.493 0 0 1-99.84 154.88 438.613 438.613 0 0 1-311.467 128z"></path>
        </svg>
      </div>
      <div
        className="tb-icon tb-icon-auto dark:text-dark fill-gray-600"
        style={{ height: 20 }}
        title="自动模式"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={20}
          height={20}
          viewBox="0 0 1024 1024"
          aria-label="auto icon"
        >
          <path d="M512 992C246.92 992 32 777.08 32 512S246.92 32 512 32s480 214.92 480 480-214.92 480-480 480zm0-840c-198.78 0-360 161.22-360 360 0 198.84 161.22 360 360 360s360-161.16 360-360c0-198.78-161.22-360-360-360zm0 660V212c165.72 0 300 134.34 300 300 0 165.72-134.28 300-300 300z"></path>
        </svg>
      </div>
    </div>
  );
}
