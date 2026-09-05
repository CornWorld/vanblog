/* UPSTREAM: packages/website/components/Waline/core.tsx@4b488500be8100b19772ec00d8315f343a6ac21e
 * SEAM: 评论(唯一刻意分叉)— Waline → Artalk(平台 site.commentsProvider='artalk')。
 * props 形状兼容 Waline/core.tsx({server, path});dark 联动监听平台 darkmodechange
 * 事件(与 src/components/Comments.astro 内联脚本一致)。上游 fix → 对本文件 apply patch。
 */
import { useEffect, useRef } from "react";

export default function CommentArtalk(props: {
  server: string;
  path?: string;
  site?: string;
}) {
  const { current } = useRef<{ hasInit: boolean }>({ hasInit: false });
  useEffect(() => {
    if (current.hasInit || !props.server) return;
    current.hasInit = true;
    const el = document.getElementById("artalk-container");
    if (!el) return;
    const server = props.server;
    const site = props.site || "VanBlog";
    const pageKey = props.path || window.location.pathname;
    const getDark = () => document.documentElement.classList.contains("dark");

    // 幂等注入 Artalk 静态资源(与原 Comments.astro 一致)
    const ensureAsset = (tag: "link" | "script", attr: "href" | "src") => {
      const url = `${server}/dist/${tag === "link" ? "Artalk.css" : "Artalk.js"}`;
      if (!document.querySelector(`${tag}[${attr}="${url}"]`)) {
        const node = document.createElement(tag);
        node.setAttribute(attr, url);
        if (tag === "link") node.setAttribute("rel", "stylesheet");
        document.head.appendChild(node);
      }
      return url;
    };
    ensureAsset("link", "href");
    const jsUrl = ensureAsset("script", "src");

    const init = () => {
      const Artalk = (window as { Artalk?: unknown }).Artalk; // 外部脚本全局,无类型声明
      if (!el || typeof Artalk === "undefined") return;
      const instance = (
        Artalk as { init: (opts: Record<string, unknown>) => { ui?: { setDarkMode: (d: boolean) => void } } }
      ).init({
        el: "#artalk-container",
        server,
        site,
        pageKey,
        darkMode: getDark() ? "dark" : false,
      });
      const onDark = (e: Event) => {
        const detail = (e as CustomEvent<{ dark?: boolean }>).detail;
        instance?.ui?.setDarkMode(detail?.dark ?? getDark());
      };
      document.documentElement.addEventListener("darkmodechange", onDark);
    };

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${jsUrl}"]`
    );
    if (existing) {
      if ((window as { Artalk?: unknown }).Artalk) init();
      else existing.addEventListener("load", init, { once: true });
    }
  }, [props.server, props.path, props.site]);
  return <div id="artalk-container" />;
}
