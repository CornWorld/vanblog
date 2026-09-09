/* UPSTREAM: packages/website/components/Footer/index.tsx@4b488500be8100b19772ec00d8315f343a6ac21e
 * SEAM: Viewer(全站访客 GlobalContext)→ SiteViewer(visits/summary);其余逐字。上游 fix → apply patch。
 */
import ImageBox from "./ImageBox";
import RunningTime from "./RunningTime";

import { useEffect, useState } from "react";

// SEAM: 上游 Viewer(全站访客,GlobalContext)→ 平台 GET /api/vanblog/visits/summary
// (全站总浏览数);两个计数位均显总浏览(平台无独立 PV/UV 差分端点)。
function SiteViewer() {
  const [total, setTotal] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/vanblog/visits/summary")
      .then((r) => (r.ok ? r.json() : { total: 0 }))
      .then((j) => { if (alive) setTotal(Number(j.total ?? 0)); })
      .catch(() => { if (alive) setTotal(0); });
    return () => { alive = false; };
  }, []);
  return (
    <span className="flex justify-center items-center dark:text-dark fill-gray-600 divide-gray-600">
      <span className="flex items-center justify-center pr-2">
        <span>
          <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="7211" width="14" height="14">
            <path d="M565.2 521.9c76.2-23 132.1-97.6 132.1-186.2 0-106.9-81.3-193.5-181.6-193.5s-181.6 86.6-181.6 193.5c0 87.6 54.6 161.6 129.5 185.4-142.2 23.1-250.8 146.5-250.8 295.3 0 2.9 0 5.8 0.1 8.7 0.9 31.5 26.5 56.7 58.1 56.7h482.1c31.2 0 57-24.6 58-55.8 0.1-3.2 0.2-6.4 0.2-9.6-0.1-147.1-106.2-269.4-246.1-294.5z" p-id="7212"></path>
          </svg>
        </span>{" "}
        {total ?? ""}
      </span>
      <span className="flex items-center justify-center pl-2">
        <span>
          <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="9714" width="14" height="14">
            <path d="M508 512m-112 0a112 112 0 1 0 224 0 112 112 0 1 0-224 0Z" p-id="9715"></path>
            <path d="M942.2 486.2C847.4 286.5 704.1 186 512 186c-192.2 0-335.4 100.5-430.2 300.3-7.7 16.2-7.7 35.2 0 51.5C176.6 737.5 319.9 838 512 838c192.2 0 335.4-100.5 430.2-300.3 7.7-16.2 7.7-35 0-51.5zM508 688c-97.2 0-176-78.8-176-176s78.8-176 176-176 176 78.8 176 176-78.8 176-176 176z" p-id="9716"></path>
          </svg>
        </span>
        {total ?? ""}
      </span>
    </span>
  );
}

export default function ({
  ipcHref,
  ipcNumber,
  since,
  version,
  gaBeianLogoUrl,
  gaBeianNumber,
  gaBeianUrl,
}: {
  // 公安备案
  gaBeianNumber: string;
  gaBeianUrl: string;
  gaBeianLogoUrl: string;
  // ipc
  ipcNumber: string;
  ipcHref: string;
  since: string;
  version: string;
}) {
  // SEAM(本仓 patch): since 无效(迁移数据 site.created 可为空串)时起始年 NaN,
  // 降级为只显示当前年。上游数据侧保证 since 有效,无此防御。
  const startYear = new Date(since).getFullYear();
  return (
    <>
      <footer className="text-center text-sm space-y-1 mt-8 md:mt-12 dark:text-dark footer-icp-number">
        {Boolean(ipcNumber) && (
          <p className="">
            ICP 编号:&nbsp;
            <a
              href={ipcHref}
              target="_blank"
              className="hover:text-gray-900 hover:underline-offset-2 hover:underline dark:hover:text-dark-hover transition"
            >
              {ipcNumber}
            </a>
          </p>
        )}
        {Boolean(gaBeianNumber) && (
          <p className="flex justify-center items-center footer-gongan-beian">
            公安备案:&nbsp;
            {Boolean(gaBeianLogoUrl) && (
              <ImageBox
                src={gaBeianLogoUrl}
                lazyLoad={true}
                alt="公安备案 logo"
                width={20}
              />
            )}
            <a
              href={gaBeianUrl}
              target="_blank"
              className="hover:text-gray-900 hover:underline-offset-2 hover:underline dark:hover:text-dark-hover transition"
            >
              {gaBeianNumber}
            </a>
          </p>
        )}
        <RunningTime since={since}></RunningTime>
        <p className="footer-powered-by-vanblog">
          Powered By&nbsp;
          <a
            href="https://vanblog.mereith.com"
            target={"_blank"}
            className="hover:text-gray-900 dark:hover:text-dark-hover transition ua ua-link"
          >
            VanBlog <span>{version}</span>
          </a>
        </p>

        <p className="select-none footer-copy-right">
          © {Number.isNaN(startYear) ? "" : `${startYear} - `}{new Date().getFullYear()}
        </p>
        <p className="select-none footer-viewer">
          <SiteViewer />
        </p>
      </footer>
    </>
  );
}
