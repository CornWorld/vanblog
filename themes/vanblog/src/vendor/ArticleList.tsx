/* UPSTREAM: packages/website/components/ArticleList/index.tsx@4b488500be8100b19772ec00d8315f343a6ac21e
 * SEAM: 1) next/link → <a>(MPA 整页导航);2) 上游 /post/{pathname||id} → 平台
 * /post/{id}(对齐上游文章路由形态);3) 上游 Article 类型 → seams/search.ts SearchHit
 * (仅消费 id/title/createdAt,与上游用到的字段一致);4) utils/getArticlePath、
 * Link/tools getTarget 内联(一行表达式)。dayjs 日期格式原样。
 * 上游 fix → 对本文件 apply patch。
 */
import dayjs from "dayjs";
import { withBase } from "../lib/base"; // SEAM: 站内链接带主题 base 前缀
import type { SearchHit } from "./seams/search";

export default function ArticleList(props: {
  articles: SearchHit[];
  showYear?: boolean;
  openArticleLinksInNewWindow: boolean;
  onClick?: () => void;
}) {
  return (
    <div className="space-y-2" onClick={props.onClick}>
      {props.articles.map((article) => (
        <a
          href={withBase(`/post/${article.id}`)}
          key={article.id}
          target={props.openArticleLinksInNewWindow ? "_blank" : "_self"}
          rel={props.openArticleLinksInNewWindow ? "noreferrer" : undefined}
        >
          <div className="dark:border-dark-2 dark:hover:border-nav-dark-light flex items-center border-b pb-1 border-dashed cursor-pointer group border-gray-200 hover:border-gray-400 ">
            <div className="text-gray-400 flex-grow-0 flex-shrink-0 text-sm  group-hover:text-gray-600 dark:text-dark-400 dark:group-hover:text-dark-light">
              {dayjs(article.createdAt).format(
                props.showYear ? "YYYY-MM-DD" : "MM-DD"
              )}
            </div>
            <div className="ml-2 md:ml-4 text-base flex-grow flex-shrink overflow-hidden text-gray-600 group-hover:text-gray-800 dark:text-dark dark:group-hover:text-dark">
              {article.title}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
