/* UPSTREAM: packages/website/components/ImageProvider/index.tsx@4b488500be8100b19772ec00d8315f343a6ac21e
 * SEAM: markdown 管线 — 上游 react-photo-view 需在构建期把每个 <img> 包进 <PhotoView>
 * (bytemd Img 插件行为);平台管线输出服务端 HTML,无法插 React 节点。
 * 改用 medium-zoom(上游 _app.tsx 已引入其 zoom.css 样式,见 styles/vendor/zoom.css)
 * 实现同等点击放大画廊行为。上游 fix → 对本文件 apply patch。
 */
import { useEffect } from "react";
import mediumZoom from "medium-zoom";

export default function ImageZoom(props: { selector?: string }) {
  useEffect(() => {
    const zoom = mediumZoom(props.selector ?? ".markdown-body img", {
      margin: 24,
      background: "rgba(0,0,0,0.8)",
    });
    return () => {
      zoom.detach();
    };
  }, [props.selector]);
  return null;
}
