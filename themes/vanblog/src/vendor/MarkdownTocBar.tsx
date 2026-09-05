/* UPSTREAM: packages/website/components/MarkdownTocBar/{index,core,tools}.tsx@4b488500be8100b19772ec00d8315f343a6ac21e
 *          + packages/website/components/Toc/index.tsx(同 SHA,导出为 TocCard)
 * SEAM: 数据层 props 化 — 上游 index.tsx 在客户端 parseNavStructure(content) 洗刷原始
 * markdown 再解析标题;平台 remark/rehype 管线已在服务端产出唯一 id 锚点,由
 * src/lib/toc.ts extractHeadings(html) 提取后经 items props 注入。
 * getEl 由 `h{level}[data-id=text]` 多重匹配改为 getElementById(平台锚点唯一、可靠)。
 * 滚动监听(throttle 100ms)/hash replaceState/800ms 平滑滚动/TOC 容器滚动条联动/
 * headroom 收放 — 全部上游原样。上游 fix → 对本文件 apply patch。
 */
import { useEffect, useRef, useState } from "react";
import throttle from "lodash/throttle";
import Headroom from "headroom.js";
import { scrollTo } from "./scroll";

/** 与 src/lib/toc.ts TocItem 结构兼容;index 为文档顺序号(上游 NavItem.index 语义)。 */
export interface NavItem {
  id: string;
  level: number; // 1-4(h1-h4)
  text: string;
  index: number;
}

// 上游 tools.ts getEl:按 tag+data-id 文本匹配、重名按序号消歧。
// 平台锚点 id 全局唯一,直接 getElementById。
const getEl = (item: NavItem): HTMLElement | null =>
  typeof document !== "undefined" ? document.getElementById(item.id) : null;

function Core(props: { items: NavItem[]; headingOffset: number; mobile?: boolean }) {
  const { items } = props;
  const [currIndex, setCurrIndex] = useState(-1);

  const updateHash = (hash: string) => {
    if (hash) {
      window.history.replaceState(null, "", `#${hash}`);
    }
  };
  const handleScroll = throttle((ev: Event) => {
    ev.stopPropagation();
    ev.preventDefault();

    let top: NavItem | null = null;
    let topEl: HTMLElement | null = null;
    let lastMin = 9999999999;
    for (const each of items) {
      const el = getEl(each);

      if (!topEl) {
        top = each;
        topEl = el;
      }
      if (el) {
        const scrollTop =
          window.pageYOffset ||
          document.documentElement.scrollTop ||
          document.body.scrollTop ||
          0;
        const v = Math.abs(scrollTop + props.headingOffset - el.offsetTop);
        if (v <= lastMin) {
          lastMin = v;
          top = each;
          topEl = el;
        }
      }
    }
    if (top) {
      setCurrIndex(top.index);
      updateHash(top.text);
    }
  }, 100);

  useEffect(() => {
    updateTocScrollbar();
  }, [currIndex, props.headingOffset]);

  const updateTocScrollbar = () => {
    const el = document.querySelector(
      "#toc-container > div > div.markdown-navigation > div.active"
    ) as HTMLElement;

    const container = document.querySelector("#toc-container");
    if (el && container) {
      let to = el?.offsetTop ?? 0;
      if (to <= props.headingOffset) {
        to = 0;
      } else {
        to = to - 100;
      }
      scrollTo(container, {
        top: to,
        behavior: "smooth",
      });
    }
    // console.log(el?.offsetTop);
  };

  //TODO 逻辑完善的 hash 更新
  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);
  const res = [];
  for (const each of items) {
    const cls = `title-anchor title-level${each.level} ${
      currIndex == each.index ? "active" : ""
    }`;
    res.push(
      <div
        key={each.index}
        className={cls}
        onClick={() => {
          const el: any = getEl(each);

          if (el) {
            let to = el.offsetTop - props.headingOffset;
            if (to <= 100) {
              to = 0;
            }
            scrollTo(window, { top: to, easing: "ease-in-out", duration: 800 });
          }
        }}
      >
        {each.text}
      </div>
    );
  }

  return (
    <>
      <div className="relative" style={{ position: "relative" }}>
        {props.mobile ? (
          <>
            <h2
              style={{ fontWeight: 600, fontSize: "1.5em", marginBottom: 4 }}
              className="text-gray-700 dark:text-dark "
            >
              目录
            </h2>
          </>
        ) : (
          <div
            className="text-center text-lg font-medium mt-4 text-gray-700 dark:text-dark cursor-pointer"
            onClick={() => {
              scrollTo(window, {
                top: 0,
                easing: "ease-in-out",
                duration: 800,
              });
            }}
          >
            目录
          </div>
        )}

        <div className="markdown-navigation" style={{ position: "relative" }}>
          {res}
        </div>
      </div>
    </>
  );
}

/** 上游 index.tsx:原为 content 解析包装;此处仅做 index 归一(props 已是解析产物)。 */
export default function MarkdownTocBar(props: {
  items: Omit<NavItem, "index">[];
  headingOffset?: number;
  mobile?: boolean;
}) {
  const items = props.items.map((it, i) => ({ ...it, index: i }));
  return (
    <Core
      items={items}
      mobile={props.mobile}
      headingOffset={props.headingOffset || 0}
    />
  );
}

/** 上游 Toc/index.tsx 原样(仅 content→items):sticky 卡片 + headroom 收放。 */
export function TocCard(props: { items: Omit<NavItem, "index">[]; showSubMenu: "true" | "false" }) {
  const { current } = useRef<{ hasInit: boolean }>({ hasInit: false });
  useEffect(() => {
    if (!current.hasInit) {
      current.hasInit = true;
      const el = document.querySelector("#toc-card");
      if (el) {
        const headroom = new Headroom(el as HTMLElement, {
          classes: {
            initial: `side-bar${props.showSubMenu == "true" ? "" : " no-submenu"}`,
            pinned: "side-bar-pinned",
            unpinned: "side-bar-unpinned",
            top: "side-bar-top",
            notTop: "side-bar-not-top",
          },
        });
        headroom.init();
      }
    }
  }, [current]);
  return (
    <div className="sticky" id="toc-card">
      <div
        id="toc-container"
        className="bg-white w-60 card-shadow dark:card-shadow-dark ml-2 dark:bg-dark overflow-y-auto pb-2"
        style={{ maxHeight: "calc(100vh - 200px)" }}
      >
        <MarkdownTocBar items={props.items} headingOffset={56} />
      </div>
    </div>
  );
}
