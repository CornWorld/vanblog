/* UPSTREAM: packages/website/pages/posts/[id].tsx@4b488500be8100b19772ec00d8315f343a6ac21e
 *          (锁定态 lock/content state + UnLockCard 装配)
 * SEAM: 平台解锁走 seams/unlock.ts → POST /api/unlock;成功后原地渲染服务端
 * 返回的消毒 HTML(平台管线产物,含 markdown-body 排版类)。上游 fix → apply patch。
 */
import { useState } from "react";
import UnLockCard from "./UnLockCard";

export default function PostLock(props: { id: string }) {
  const [lock, setLock] = useState(true);
  const [content, setContent] = useState("");
  return lock ? (
    <UnLockCard id={props.id} setLock={setLock} setContent={setContent} />
  ) : (
    <div
      className="post-viewer markdown-body"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
