/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import i18next from 'i18next';
import { getRecentTimeDes } from '@/services/van-blog/tool';
import './index.css';

export default ({
  articles,
  showViewerNum,
  showRecentViewTime,
}: {
  // TODO: Add Article type from @vanblog/shared/type
  articles: any[];
  showViewerNum: boolean;
  showRecentViewTime: boolean;
}) => (
  <div>
    {articles.map(({ id, title, viewer = 0, lastVisitedTime }) => (
      <a
        // TODO: Rename 'uaa' class to more semantic name
        className="article-list-item uaa"
        key={id}
        href={`/post/${id}`}
        target="_blank"
        rel="noreferrer"
      >
        <div className="">{title}</div>
        {showViewerNum && <div>{i18next.t('articlelist.view_count', { count: viewer || 0 })}</div>}
        {showRecentViewTime && <div>{getRecentTimeDes(lastVisitedTime)}</div>}
      </a>
    ))}
  </div>
);
