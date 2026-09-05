/* UPSTREAM: packages/website/components/RssButton/index.tsx + RssLogo/index.tsx@4b488500be8100b19772ec00d8315f343a6ac21e
 * SEAM: RssLogo 内联进本文件(仅 RssButton 一处消费;上游独立文件,搬运时注意)。
 * react-copy-to-clipboard + toast 反馈原样;/feed.xml 为平台 RSS 路径。
 * 上游 fix → 对本文件 apply patch。
 */
import { useState, useEffect } from "react";
import CopyToClipboard from "react-copy-to-clipboard";
import toast from "react-hot-toast";

/** 上游 RssLogo/index.tsx 原样。 */
function RssLogo(props: { size: number }) {
  return (
    <svg
      viewBox="0 0 1024 1024"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      p-id="5489"
      width={props.size || 20}
      height={props.size || 20}
      fill="currentColor"
    >
      <path
        d="M832.512 63.488q26.624 0 49.664 10.24t40.448 27.648 27.648 40.448 10.24 49.664l0 704.512q0 26.624-10.24 49.664t-27.648 40.448-40.448 27.648-49.664 10.24l-704.512 0q-26.624 0-49.664-10.24t-40.448-27.648-27.648-40.448-10.24-49.664l0-704.512q0-26.624 10.24-49.664t27.648-40.448 40.448-27.648 49.664-10.24l704.512 0zM188.416 923.648q19.456 0 36.864-7.168t30.208-19.968 19.968-30.208 7.168-36.864-7.168-36.864-19.968-30.208-30.208-19.968-36.864-7.168q-20.48 0-37.376 7.168t-30.208 19.968-20.48 30.208-7.168 36.864 7.168 36.864 20.48 30.208 30.208 19.968 37.376 7.168zM446.464 897.024l36.864 0q15.36 0 30.208 0.512t31.232 0.512 36.864-1.024q0-93.184-35.84-175.616t-97.28-143.872-143.872-96.768-175.616-35.328q-1.024 24.576-1.024 39.936l0 28.672q0 14.336 0.512 29.184t0.512 37.376q65.536 0 123.392 24.576t100.864 67.584 68.096 100.864 25.088 123.392zM707.584 894.976q36.864 0 49.152 0.512t18.432 1.536 15.872 1.024 41.472-2.048q0-145.408-55.296-272.896t-150.528-222.72-223.232-150.528-273.408-55.296q-1.024 25.6-1.024 36.864l0 16.384q0 4.096 0.512 5.632t0.512 7.168 0.512 18.432 0.512 40.448q119.808 0 224.768 45.056t183.296 123.392 123.392 183.296 45.056 223.744z"
        p-id="5490"
      ></path>
    </svg>
  );
}

export default function RssButton(props: { showAdminButton: boolean }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    setUrl(`${location.protocol}//${location.host}/feed.xml`);
  }, [setUrl]);
  return (
    <div
      title="RSS 订阅"
      className={`flex items-center  justify-center cursor-pointer hover:scale-125 transform transition-all ${
        props.showAdminButton ? "mr-4 md:mr-6 lg:mr-2 " : "mr-4 md:mr-4 lg:mr-4"
      }`}
    >
      <CopyToClipboard
        text={url}
        onCopy={() => {
          toast.success("已复制 RSS 订阅地址到剪切板！", {
            className: "toast",
          });
        }}
      >
        <div className="dark:text-dark text-gray-600">
          <RssLogo size={20} />
        </div>
      </CopyToClipboard>
    </div>
  );
}
