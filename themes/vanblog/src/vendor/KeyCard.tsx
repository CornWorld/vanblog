/* UPSTREAM: packages/website/components/KeyCard/index.tsx@4b488500be8100b19772ec00d8315f343a6ac21e
 * UPSTREAM: packages/website/utils/ua.ts@4b488500be8100b19772ec00d8315f343a6ac21e
 * SEAM: utils/ua isMac 内联。上游 fix → 对本文件 apply patch。
 * 偏离(2026-10-04,修「⌘ 切页闪烁」):不再 useState("Ctrl") + useEffect 换
 * ⌘(SSR 恒 Ctrl,水合后才替换 → 整页导航必闪 + 宽度跳变)。改为 SSR 同时
 * 渲染 ⌘/Ctrl 两枚,FOUC 脚本在首帧前给 html 打 platform-mac,CSS 决定
 * 显示哪枚;两枚宽度不同也不会跳动(只渲染命中平台的那枚)。
 */
export default function KeyCard(props: { type: "search" | "esc" }) {
  if (props.type == "search") {
    return (
      <div className="flex items-center">
        <span
          style={{ opacity: 1, height: 24 }}
          className="hidden sm:flex items-center  text-gray-500 text-sm leading-5 py-0.5 px-1.5 border border-gray-300 rounded-md dark:text-dark dark:border-dark"
        >
          <span className="sr-only">Press </span>
          <kbd className="font-sans ">
            <abbr className="no-underline key-hint-mac hidden" aria-hidden="true">⌘</abbr>
            <abbr className="no-underline key-hint-other">Ctrl</abbr>
          </kbd>
          <span className="mx-1">+</span>
          <span className="sr-only"> and </span>
          <kbd className="font-sans ">K</kbd>
          <span className="sr-only"> to search</span>
        </span>
      </div>
    );
  } else {
    return (
      <div className="flex items-center select-none ml-2">
        <span
          style={{ opacity: 1, height: 24, lineHeight: "17.73px" }}
          className="hidden sm:block text-gray-500 text-sm leading-5 py-0.5 px-1.5 border border-gray-300 rounded-md dark:text-dark dark:border-dark"
        >
          <span className="sr-only">Press </span>
          <kbd className="font-sans">esc</kbd>
          <span className="sr-only"> to close</span>
        </span>
      </div>
    );
  }
}
