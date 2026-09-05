/* UPSTREAM: packages/website/components/PostViewer/index.tsx@4b488500be8100b19772ec00d8315f343a6ac21e
 * SEAM: 数据层 — 上游 fetch GET /api/public/article/viewer/{id};平台文章计数由
 * Go 层 POST /api/vanblog/visits/record 原子自增(文章页 inline 脚本负责,本组件
 * 不重复计数),SSR 将当前 viewCount 经 initial props 注入。
 * noViewer localStorage 语义与 +1 乐观显示逻辑原样。上游 fix → 对本文件 apply patch。
 */
import { useEffect, useRef, useState } from "react";

export default function Viewer(props: {
  id: string;
  shouldAddViewer: boolean;
  /** 服务端注入的当前 viewCount(上游 res.viewer 对应物) */
  initial: number;
}) {
  const [viewer, setViewer] = useState(0);
  const { current } = useRef<{ hasInit: boolean }>({ hasInit: false });
  useEffect(() => {
    if (!current.hasInit) {
      current.hasInit = true;
      const res = props.initial;
      if (!res) {
        if (localStorage?.getItem("noViewer") === "true") {
          setViewer(0);
          return;
        }
        if (props.shouldAddViewer) {
          setViewer(1);
        } else {
          setViewer(0);
        }
      }
      if (res) {
        if (localStorage?.getItem("noViewer") === "true") {
          setViewer(res);
          return;
        }
        if (props.shouldAddViewer) {
          setViewer(res + 1);
        } else {
          setViewer(res);
        }
      }
    }
  }, []);

  return <span>{viewer}</span>;
}
