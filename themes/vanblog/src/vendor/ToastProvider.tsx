/* UPSTREAM: packages/website/components/Layout/index.tsx@4b488500be8100b19772ec00d8315f343a6ac21e
 *          (Layout 内 <Toaster /> 挂载点,独立成 island)
 * SEAM: 布局 — toast 容器;.toast 深色样式见 styles/vendor/upstream-globals.css。
 * 上游 fix → 对本文件 apply patch(上游改 Layout 时人工搬运)。
 */
import { Toaster } from "react-hot-toast";

export default function ToastProvider() {
  return <Toaster />;
}
