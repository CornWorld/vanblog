/* UPSTREAM: packages/website/components/PostCard/bottom.tsx@4b488500be8100b19772ec00d8315f343a6ac21e
 * SEAM: next/link → <a> + withBase;utils/getArticlePath、utils/encode、
 * Link/tools getTarget 内联(逐字符同式)。上游 fix → 对本文件 apply patch。
 */
import { useMemo } from "react";
import { withBase } from "../lib/base";

const encodeQuerystring = (s: string) => {
  if (!s) {
    return "";
  }
  return s.replace(/#/g, "%23").replace(/\//g, "%2F");
};

const getTarget = (newTab: boolean) => (newTab ? "_blank" : "_self");

const getArticlePath = (article: { id: number | string; pathname?: string }) =>
  `${article.pathname ? article.pathname : article.id}`;

export function PostBottom(props: {
  type: "overview" | "article" | "about";
  lock: boolean;
  tags?: string[];
  next?: { id: number | string; title: string; pathname?: string };
  pre?: { id: number | string; title: string; pathname?: string };
  openArticleLinksInNewWindow: boolean;
}) {
  const show = useMemo(() => {
    if (props.type == "article" && !props.lock) {
      return true;
    }
    return false;
  }, [props]);
  return show ? (
    <div className="mt-4">
      {props.tags && props.tags.length > 0 && (
        <div className="text-sm flex-wrap text-gray-500 flex justify-center space-x-2 select-none dark:text-dark">
          {props.tags.map((tag) => (
            <div key={`article-tag-${tag}`}>
              <a
                href={withBase(`/tag/${encodeQuerystring(tag)}`)}
                target={getTarget(props.openArticleLinksInNewWindow)}
              >
                <div className=" border-b border-white hover:border-gray-500 dark:border-dark dark:hover:border-gray-300 dark:hover:text-gray-300">{`${tag}`}</div>
              </a>
            </div>
          ))}
        </div>
      )}
      <hr className="mt-3 dark:border-hr-dark" />
      <div className="flex justify-between text-sm mt-2 whitespace-nowrap overflow-hidden ">
        <div className="" style={{ maxWidth: "50%" }}>
          {props.pre?.id && (
            <a
              href={withBase(`/post/${getArticlePath(props.pre)}`)}
              target={getTarget(props.openArticleLinksInNewWindow)}
            >
              <div
                style={{ whiteSpace: "break-spaces" }}
                className="dark:text-dark dark:border-dark dark-border-hover border-b pb border-dashed hover:border-gray-800 border-white hover:text-gray-800"
              >{`< ${props.pre?.title}`}</div>
            </a>
          )}
        </div>
        <div className="" style={{ maxWidth: "50%" }}>
          {props.next?.id && (
            <a
              href={withBase(`/post/${getArticlePath(props.next)}`)}
              target={getTarget(props.openArticleLinksInNewWindow)}
            >
              <div
                style={{ whiteSpace: "break-spaces" }}
                className="dark:text-dark dark:border-dark  dark-border-hover border-b pb border-dashed hover:border-gray-800 border-white hover:text-gray-800"
              >{`${props.next?.title} >`}</div>
            </a>
          )}
        </div>
      </div>
    </div>
  ) : null;
}
