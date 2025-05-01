import React from 'react';
import i18next from 'i18next';
import { getRecentTimeDes } from '@/services/van-blog/tool';
import './index.css';

export default ({
  articles,
  showViewerNum,
  showRecentViewTime,
}: {
  // FIXME: Add Article type
  articles: unknown[];
  showViewerNum: boolean;
  showRecentViewTime: boolean;
}) => (
  <div>
    {articles.map(({ id, title, viewer = 0, lastVisitedTime }) => (
      <a
        // FIXME: uaa is not a good name
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
