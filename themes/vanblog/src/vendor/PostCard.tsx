/* UPSTREAM: packages/website/components/PostCard/index.tsx@4b488500be8100b19772ec00d8315f343a6ac21e
 * SEAM: 1) next/link → <a> + withBase;2) Markdown/bytemd(客户端渲染)→ 平台
 * remark/rehype 服务端同构产物 contentHtml/excerptHtml/encryptedHtml(消毒后
 * dangerouslySetInnerHTML,双层 .markdown-body 与上游 DOM 同构);3) hasToc/
 * TocMobile 解析 → 服务端 extractHeadings 预计算 items;4) WaLine → CommentArtalk
 * (唯一刻意评论分叉);5) 解锁流:UnLockCard setContent 收服务端消毒 HTML。
 * 其余逻辑逐字。上游 fix → 对本文件 apply patch。
 */
import { useMemo, useState } from "react";
import AlertCard from "./AlertCard";
import CopyRight from "./CopyRight";
import Reward from "./Reward";
import TopPinIcon from "./TopPinIcon";
import UnLockCard from "./UnLockCard";
import CommentArtalk from "./CommentArtalk";
import { PostBottom } from "./PostCardBottom";
import { SubTitle, Title } from "./PostCardTitle";
import MarkdownTocBar from "./MarkdownTocBar";
import type { NavItem } from "./MarkdownTocBar";
import { withBase } from "../lib/base";

const getTarget = (newTab: boolean) => (newTab ? "_blank" : "_self");

// SEAM: 上游 TocMobile/index.tsx 包装层逐字(内部 MarkdownTocBar 为平台 items 版)
function TocMobile(props: { items: Omit<NavItem, "index">[] }) {
  return (
    <div className="block lg:hidden toc-mobile">
      <MarkdownTocBar
        items={props.items}
        headingOffset={56}
        mobile={true}
      />
    </div>
  );
}

export default function (props: {
  id: number | string;
  title: string;
  updatedAt: Date;
  createdAt: Date;
  catelog: string;
  setContent: (content: string) => void;
  type: "overview" | "article" | "about";
  pay?: string[];
  payDark?: string[];
  author?: string;
  tags?: string[];
  next?: { id: number | string; title: string; pathname?: string };
  pre?: { id: number | string; title: string; pathname?: string };
  enableComment: "true" | "false";
  top: number;
  private: boolean;
  showDonateInAbout?: boolean;
  hideDonate?: boolean;
  hideCopyRight?: boolean;
  openArticleLinksInNewWindow: boolean;
  copyrightAggreement: string;
  customCopyRight: string | null;
  showExpirationReminder: boolean;
  showEditButton: boolean;
  /** SEAM: 服务端渲染管线产物 — type=article 全文 / overview 摘要 / 加密卡提示,
   * 已消毒 HTML(对应上游 raw content + 客户端 Markdown/bytemd 渲染) */
  contentHtml: string;
  /** SEAM: overview 加密卡提示 HTML(上游由 calContent 内联字符串渲染) */
  encryptedHtml?: string;
  /** SEAM: overview 摘要 HTML(上游按 <!-- more --> 客户端切分) */
  excerptHtml?: string;
  /** SEAM: hasToc(content) 服务端预计算 + 标题锚点提取(extractHeadings) */
  showToc?: boolean;
  tocItems?: Omit<NavItem, "index">[];
  /** SEAM: Artalk 服务地址(上游 WaLine 自取站点配置) */
  commentsServer?: string;
  /** SEAM: 服务端注入当前浏览计数(上游 PostViewer 客户端自取) */
  views?: number;
}) {
  const [lock, setLock] = useState(props.type != "overview" && props.private);
  const { setContent } = props;
  const showDonate = useMemo(() => {
    if (lock) {
      return false;
    }
    if (props.hideDonate) {
      return false;
    }
    if (!props.pay || props.pay.length <= 0) {
      return false;
    }
    if (props.type == "article") {
      return true;
    }
    if (props.type == "about" && props.showDonateInAbout) {
      return true;
    }
    return false;
  }, [props, lock]);

  // SEAM: 摘要/加密提示切分已在服务端完成(remark/rehype 同构渲染),直接取
  // 渲染产物;lock 解锁后 setContent 下发的也是服务端消毒 HTML。
  const calContent = lock
    ? props.contentHtml
    : props.type == "overview"
      ? (props.private ? props.encryptedHtml ?? props.contentHtml : props.excerptHtml ?? props.contentHtml)
      : props.contentHtml;

  const showToc = !lock && props.type == "article" && props.showToc;

  return (
    <div className="post-card-wrapper">
      <div
        style={{ position: "relative" }}
        id="post-card"
        className="overflow-hidden post-card bg-white card-shadow py-4 px-1 sm:px-3 md:py-6 md:px-5 dark:bg-dark  dark:nav-shadow-dark"
      >
        {props.top != 0 && <TopPinIcon></TopPinIcon>}
        <Title
          type={props.type}
          id={props.id}
          title={props.title}
          openArticleLinksInNewWindow={props.openArticleLinksInNewWindow}
          showEditButton={props.showEditButton}
        />

        <SubTitle
          views={props.views}
          openArticleLinksInNewWindow={props.openArticleLinksInNewWindow}
          type={props.type}
          id={props.id}
          updatedAt={props.updatedAt}
          createdAt={props.createdAt}
          catelog={props.catelog}
          enableComment={props.enableComment}
        />
        <div className="text-sm md:text-base  text-gray-600 mt-4 mx-2">
          {props.type == "article" && (
            <AlertCard
              showExpirationReminder={props.showExpirationReminder}
              updatedAt={props.updatedAt}
              createdAt={props.createdAt}
            ></AlertCard>
          )}
          {lock ? (
            <UnLockCard
              setLock={setLock}
              setContent={setContent}
              id={props.id}
            />
          ) : (
            <>
              {showToc && props.tocItems && <TocMobile items={props.tocItems} />}
              <div className="markdown-body">
                <div
                  className="markdown-body"
                  dangerouslySetInnerHTML={{ __html: calContent }}
                />
              </div>
            </>
          )}
        </div>

        {props.type == "overview" && (
          <div className="w-full flex justify-center mt-4 ">
            <a
              href={withBase(`/post/${props.id}`)}
              target={getTarget(props.openArticleLinksInNewWindow)}
            >
              <div className=" dark:bg-dark dark:hover:bg-dark-light dark:hover:text-dark-r dark:border-dark dark:text-dark hover:bg-gray-800 hover:text-gray-50 border-2 border-gray-800 text-sm md:text-base text-gray-700 px-2 py-1 transition-all rounded">
                阅读全文
              </div>
            </a>
          </div>
        )}
        {showDonate && props.pay && (
          <Reward
            aliPay={(props?.pay as any)[0]}
            weChatPay={(props?.pay as any)[1]}
            aliPayDark={(props?.payDark || ["", ""])[0]}
            weChatPayDark={(props?.payDark || ["", ""])[1]}
            author={props.author as any}
            id={props.id}
          ></Reward>
        )}
        {props.type == "article" && !lock && !props?.hideCopyRight && (
          <CopyRight
            customCopyRight={props.customCopyRight}
            author={props.author as any}
            id={props.id}
            showDonate={showDonate}
            copyrightAggreement={props.copyrightAggreement}
          ></CopyRight>
        )}

        <PostBottom
          type={props.type}
          lock={lock}
          tags={props.tags}
          next={props.next}
          pre={props.pre}
          openArticleLinksInNewWindow={props.openArticleLinksInNewWindow}
        />
        <div
          style={{
            height: props.type == "about" && !showDonate ? "16px" : "0",
          }}
        ></div>
      </div>
      {/* SEAM: WaLine → CommentArtalk(唯一刻意评论分叉);文章级 pay 打赏
          登记延后(pay 字段平台 posts 表未落,见决策文档对照表) */}
      {props.type != "overview" && (
        <CommentArtalk server={props.commentsServer || ""} path={props.type == "about" ? "/about" : "/post/" + props.id} />
      )}
    </div>
  );
}
