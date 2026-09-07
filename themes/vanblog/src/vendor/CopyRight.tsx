/* UPSTREAM: packages/website/components/CopyRight/index.tsx@4b488500be8100b19772ec00d8315f343a6ac21e
 * SEAM: react-copy-to-clipboard → navigator.clipboard.writeText(依赖减法,
 * 成功回调同 toast)。上游 fix → 对本文件 apply patch。
 */
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

export default function (props: {
  author: string;
  id: number | string;
  showDonate: boolean;
  copyrightAggreement: string;
  customCopyRight: string | null;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    setUrl(`${location.protocol}//${location.host}${location.pathname}`);
  }, [setUrl]);

  const text = useMemo(() => {
    if (props.customCopyRight) return props.customCopyRight;
    return `本博客所有文章除特别声明外，均采用 ${props.copyrightAggreement}
    许可协议。转载请注明出处！`;
  }, [props.customCopyRight, props.copyrightAggreement]);

  return (
    <div
      className={`bg-gray-100 px-5 border-l-4 border-red-500  py-2 text-sm space-y-1 dark:text-dark  dark:bg-dark ${
        !props.showDonate ? "mt-8" : ""
      }`}
    >
      <p>
        <span className="mr-2">本文作者:</span>
        <span>{props.author}</span>
      </p>
      <p>
        <span className="mr-2">本文链接:</span>
        <span
          onClick={() => {
            navigator.clipboard.writeText(decodeURIComponent(url)).then(() => {
              toast.success("复制成功！", {
                className: "toast",
              });
            });
          }}
        >
          <span
            className="cursor-pointer border-b border-gray-100 hover:border-gray-500 dark:text-dark dark-border-hover dark:border-nav-dark"
            style={{ wordBreak: "break-all" }}
          >
            {decodeURIComponent(url)}
          </span>
        </span>
      </p>
      <p>
        <span className="mr-2">版权声明:</span>
        <span>{text}</span>
      </p>
    </div>
  );
}
