import React, { useCallback, useState } from 'react';
import i18next from 'i18next';
import { Empty, Image, Spin } from 'antd';
import { getImgLink } from './tools';
import { StaticItem } from '../types';

interface SafeImgPageProps {
  data: StaticItem[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  handlePageChange: (page: number, pageSize: number) => void;
  responsive: boolean;
  displayMenu: (e: React.MouseEvent, item: StaticItem) => void;
}

export const SafeImgPage: React.FC<SafeImgPageProps> = ({ data, loading, displayMenu }) => {
  const [shouldRender, setShouldRender] = useState(false);

  setTimeout(() => {
    setShouldRender(true);
  }, 500);

  const handleClick = useCallback(
    (e: React.MouseEvent, item: StaticItem) => {
      e.preventDefault();
      displayMenu(e, item);
    },
    [displayMenu],
  );

  if (!shouldRender) {
    return <div style={{ height: 300 }} />;
  }

  return (
    <Spin spinning={loading}>
      {(!data || data.length === 0) && <Empty description={i18next.t('safeimgpage.empty')} />}
      <Image.PreviewGroup>
        {data.map((item) => (
          <Image
            key={item.sign}
            src={getImgLink(item.realPath)}
            alt={item.name}
            style={{ width: 100, height: 100, margin: 8, objectFit: 'cover' }}
            onContextMenu={(e) => handleClick(e, item)}
          />
        ))}
      </Image.PreviewGroup>
    </Spin>
  );
};
