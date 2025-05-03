import React from 'react';
import { Menu, Item, useContextMenu } from 'react-contexify';
import {
  InfoCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
  SearchOutlined,
  DownloadOutlined,
} from '@ant-design/icons';

interface ContextMenuPortalProps {
  showDelBtn: boolean;
  handleItemClick: (params: { data: string }) => void;
}

export const ContextMenuPortal: React.FC<ContextMenuPortalProps> = ({
  showDelBtn,
  handleItemClick,
}) => {
  useContextMenu({
    id: 'img-context-menu',
  });

  return (
    <Menu id="img-context-menu" animation={false}>
      <Item onClick={() => handleItemClick({ data: 'info' })} id="info">
        <InfoCircleOutlined style={{ marginRight: 8 }} />
        图片信息
      </Item>
      <Item onClick={() => handleItemClick({ data: 'copy' })} id="copy">
        <CopyOutlined style={{ marginRight: 8 }} />
        复制图片链接
      </Item>
      <Item onClick={() => handleItemClick({ data: 'copyMarkdown' })} id="copyMarkdown">
        <CopyOutlined style={{ marginRight: 8 }} />
        复制 Markdown
      </Item>
      <Item
        onClick={() => handleItemClick({ data: 'copyMarkdownAbsolutely' })}
        id="copyMarkdownAbsolutely"
      >
        <CopyOutlined style={{ marginRight: 8 }} />
        复制绝对 Markdown
      </Item>
      <Item onClick={() => handleItemClick({ data: 'download' })} id="download">
        <DownloadOutlined style={{ marginRight: 8 }} />
        下载图片
      </Item>
      <Item onClick={() => handleItemClick({ data: 'searchByLink' })} id="searchByLink">
        <SearchOutlined style={{ marginRight: 8 }} />
        搜索文章引用
      </Item>
      {showDelBtn && (
        <Item onClick={() => handleItemClick({ data: 'delete' })} id="delete">
          <DeleteOutlined style={{ marginRight: 8 }} />
          删除
        </Item>
      )}
    </Menu>
  );
};
