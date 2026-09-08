/* UPSTREAM: packages/website/components/PageNav/{core.ts,index.tsx,render.tsx}@4b488500be8100b19772ec00d8315f343a6ac21e
 * SEAM: next/link → <a> + withBase(base/more href 统一走主题根);其余逐字。
 * 上游 fix → 对本文件 apply patch。
 */
import { withBase } from "../lib/base";

export type PageItemType =
  | "pre-btn"
  | "pre-btn-disable"
  | "next-btn"
  | "next-btn-disable"
  | "link"
  | "link-cur"
  | "pre-more"
  | "next-more";
export interface PageItem {
  type: PageItemType;
  href: string;
  page: number;
}
export interface PageNavProps {
  total: number;
  current: number;
  base: string;
  more: string;
  pageSize?: number;
}
export const calItemList = (props: PageNavProps) => {
  const res: PageItem[] = [];
  const pageSize = props.pageSize || 5;
  const pageNum = Math.ceil(props.total / pageSize);
  // 计算一个 more 的 href
  let moreHref = props.current + 5;
  let lessHref = props.current - 5;
  if (moreHref > pageNum) {
    moreHref = pageNum;
  }
  if (lessHref < 1) {
    lessHref = 1;
  }
  if (props.current == 1) {
    // 先计算开始的
    res.push({
      type: "pre-btn-disable",
      href: `${props.base}`,
      page: 1,
    });
  } else {
    if (props.current - 1 == 1) {
      res.push({
        type: "pre-btn",
        href: `${props.base}`,
        page: 1,
      });
    } else {
      res.push({
        type: "pre-btn",
        href: `${props.more}/${props.current - 1}`,
        page: props.current - 1,
      });
    }
  }

  // 根据参数计算出要渲染的列表
  // 1. 如果页数小于7，那直接都渲染。
  if (pageNum <= 7) {
    for (let i = 1; i <= pageNum; i++) {
      res.push({
        type: i == props.current ? "link-cur" : "link",
        href: i == 1 ? `${props.base}` : `${props.more}/${i}`,
        page: i,
      });
    }
  } else {
    // 如果前4页, 那就是 xxxx, ... 模式
    if (props.current <= 4) {
      for (let i = 1; i <= 3; i++) {
        res.push({
          type: i == props.current ? "link-cur" : "link",
          href: i == 1 ? `${props.base}` : `${props.more}/${i}`,
          page: i,
        });
      }
      // 加一个item

      res.push({
        type: props.current == 4 ? "link-cur" : "link",
        href: `${props.more}/${4}`,
        page: 4,
      });

      // 然后一个 。。。
      res.push({
        type: "next-more",
        href: `${props.more}/${moreHref}`,
        page: moreHref,
      });
      // 然后一个 link
      res.push({
        type: "link",
        href: `${props.more}/${pageNum}`,
        page: pageNum,
      });
    }
    // 倒数4页内，那就是 ....,xxxx 模式
    else if (pageNum - props.current < 4) {
      res.push({
        type: "link",
        href: `${props.base}`,
        page: 1,
      });
      res.push({
        type: "pre-more",
        href: lessHref == 1 ? `${props.base}` : `${props.more}/${lessHref}`,
        page: lessHref,
      });
      // 剩下的4个
      for (let i = pageNum - 3; i <= pageNum; i++) {
        res.push({
          type: i == props.current ? "link-cur" : "link",
          href: `${props.more}/${i}`,
          page: i,
        });
      }
    }
    // 都不是，那就是中间模式
    else {
      // 首页
      res.push({
        type: "link",
        href: `${props.base}`,
        page: 1,
      });
      // 前面的 。。。
      res.push({
        type: "pre-more",
        href: lessHref == 1 ? `${props.base}` : `${props.more}/${lessHref}`,
        page: lessHref,
      });
      // 中间的3个
      res.push({
        type: "link",
        href: `${props.more}/${props.current - 1}`,
        page: props.current - 1,
      });
      res.push({
        type: "link-cur",
        href: `${props.more}/${props.current}`,
        page: props.current,
      });
      res.push({
        type: "link",
        href: `${props.more}/${props.current + 1}`,
        page: props.current + 1,
      });

      // 后面的 。。。
      res.push({
        type: "next-more",
        href: `${props.more}/${moreHref}`,
        page: moreHref,
      });
      // 尾页
      res.push({
        type: "link",
        href: `${props.more}/${pageNum}`,
        page: pageNum,
      });
    }
  }
  // 增加一个末尾按钮
  if (props.current == pageNum) {
    res.push({
      type: "next-btn-disable",
      href: `${props.more}/${pageNum}`,
      page: pageNum,
    });
  } else {
    res.push({
      type: "next-btn",
      href: `${props.more}/${props.current + 1}`,
      page: props.current + 1,
    });
  }
  return res;
};


import type { CSSProperties } from "react";
const commonCls =
  "inline-flex justify-center items-center   transition-all text-gray-600";
const btnCls =
  "bg-white hover:bg-gray-200 dark:hover:bg-dark-hover dark:hover:pg-text-dark-hover";
const commonStyle: CSSProperties = {
  height: "28px",
  width: "28px",
  borderRadius: "4px",
  fontSize: "14px",
};
const renderLink = (item: PageItem, isCur: boolean) => {
  return (
    <a
      href={withBase(item.href)}
      key={`LinkItem-${item.page}-${item.type}-${item.href}`}
    >
      <div
        style={commonStyle}
        className={`${commonCls} ${btnCls}  ${isCur
          ? "bg-gray-200 dark:bg-dark-hover dark:pg-text-dark-hover"
          : "dark:bg-dark-1 dark:pg-text-dark "
          }`}
      >
        {item.page}
      </div>
    </a>
  );
};
const renderBtn = (item: PageItem, _disable: boolean, isNext: boolean) => {
  return (
    <a
      href={withBase(item.href)}
      key={`pagenav-btn-${item.page}-${item.href}-${isNext}`}
    >
      <div
        style={commonStyle}
        className={`${commonCls} dark:bg-dark-1 dark:pg-text-dark  ${btnCls}`}
      >
        {isNext ? "›" : "‹"}
      </div>
    </a>
  );
};
const renderMore = (item: PageItem, isNext: boolean) => {
  return (
    <a
      href={withBase(item.href)}
      key={`pagenav-more-${item.page}-${item.href}-${isNext}`}
    >
      <div style={commonStyle} className={`dark:pg-text-dark ${commonCls}`}>
        •••
      </div>
    </a>
  );
};

export const RenderItemList = (props: { items: PageItem[] }) => {
  const res: React.ReactElement[] = [];
  for (const item of props.items) {
    switch (item.type) {
      case "link":
        res.push(renderLink(item, false));
        break;
      case "link-cur":
        res.push(renderLink(item, true));
        break;
      case "next-btn":
        res.push(renderBtn(item, false, true));
        break;
      case "next-btn-disable":
        res.push(renderBtn(item, true, true));
        break;
      case "next-more":
        res.push(renderMore(item, true));
        break;
      case "pre-more":
        res.push(renderMore(item, false));
        break;
      case "pre-btn":
        res.push(renderBtn(item, false, false));
        break;
      case "pre-btn-disable":
        res.push(renderBtn(item, true, false));
        break;
    }
  }
  return <ul className="space-x-2 text-center">{res}</ul>;
};


export default function (props: PageNavProps) {
  const pageSize = props?.pageSize || 5;
  const show = props.total > pageSize;
  return show ? (
    <div className="mt-4">
      <div>
        <RenderItemList items={calItemList(props)}></RenderItemList>
      </div>
    </div>
  ) : (
    <div></div>
  );
}
