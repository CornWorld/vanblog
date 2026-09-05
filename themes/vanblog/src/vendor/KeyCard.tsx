/* UPSTREAM: packages/website/components/KeyCard/index.tsx@4b488500be8100b19772ec00d8315f343a6ac21e
 * SEAM: utils/ua isMac 内联(platform 探测一行,不值得跨文件)。其余原样。
 * 上游 fix → 对本文件 apply patch。
 */
import { useEffect, useState } from "react";

export default function KeyCard(props: { type: "search" | "esc" }) {
  const [keyString, setKeyString] = useState("Ctrl");
  useEffect(() => {
    if (/Mac|iPhone|iPad|iPod/.test(navigator.userAgent)) {
      setKeyString("⌘");
    }
  }, []);
  if (props.type == "search") {
    return (
      <div className="flex items-center">
        <span
          style={{ opacity: 1, height: 24 }}
          className="hidden sm:flex items-center  text-gray-500 text-sm leading-5 py-0.5 px-1.5 border border-gray-300 rounded-md dark:text-dark dark:border-dark"
        >
          <span className="sr-only">Press </span>
          <kbd className="font-sans ">
            <abbr className="no-underline ">{keyString}</abbr>
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
