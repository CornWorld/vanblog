import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Modal, message, Spin, Empty } from 'antd';
import RcResizeObserver from 'rc-resize-observer';
import { useModel } from '@/router';
import { useTab } from '@/services/van-blog/useTab';
import { useNum } from '@/services/van-blog/useNum';
import TipTitle from '@/components/TipTitle';
import ObjTable from '@/components/ObjTable';
import { ImageGrid } from './components/ImageGrid';
import { PaginationComponent } from './components/Pagination';
import { ActionButtons } from './components/ActionButtons';
import { ContextMenuPortal } from './components/ContextMenuPortal';
import { StaticItem } from './types';
import 'react-contexify/dist/ReactContexify.css';
import './index.less';

import { deleteImgBySign, getImgs, searchArtclesByLink } from '@/services/van-blog/api';
import { mergeMetaInfo, copyImgLink, downloadImg, getImgLink } from './components/tools';

const trans_zh = {
  'image.title': '图片管理',
  'image.tip': '设置页可更改图片存储方式。对着图片点右键可解锁更多操作哦',
  'image.error.get': '获取图片失败',
  'image.modal.info.title': '图片信息',
  'image.modal.delete.title': '确定删除该图片吗？删除后不可恢复！',
  'image.message.delete.success1': '删除成功！',
  'image.message.delete.success2': '但是 OSS 存储中并未删除哦',
  'image.message.delete.success3': '已彻底删除',
  'image.message.delete.error': '删除失败！',
  'image.modal.reference.title': '被引用文章',
  'image.table.column.id': '文章 ID',
  'image.table.column.title': '标题',
  'image.table.column.actions': '操作',
  'image.action.edit': '编辑',
  'image.empty.description': '没有图片',
};

interface ArticleReference {
  id: string;
  title: string;
}

interface ApiResponse<T> {
  data: T;
  [key: string]: unknown;
}

const ImageManager: React.FC = () => {
  // State management
  const [data, setData] = useState<StaticItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useTab(1, 'page');
  const [responsive, setResponsive] = useState(false);
  const [clickItem, setClickItem] = useState<StaticItem>();

  // Using useNum hook with proper typing
  const [pageSize, setPageSize] = useNum(responsive ? 9 : 15, 'static-img-page-size');

  const { initialState } = useModel();

  // Permission checks
  const showDelBtn = useMemo(() => {
    if (!initialState?.user) return false;
    if (initialState.user.id === 0) return true;

    const ps = initialState.user?.permissions;
    if (!ps || ps.length === 0) return false;

    return ps.includes('img:delete') || ps.includes('all');
  }, [initialState]);

  const showDelAllBtn = useMemo(() => {
    return initialState?.version === 'dev';
  }, [initialState]);

  // Data fetching
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = (await getImgs(page, pageSize as number)) as ApiResponse<{
        data: StaticItem[];
        total: number;
      }>;

      if (response.data) {
        setTotal(response.data.total || 0);
        setData(response.data.data || []);
      } else {
        setData([]);
        setTotal(0);
      }
    } catch (error) {
      console.error('Failed to fetch images:', error);
      message.error(trans_zh['image.error.get']);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Context menu handler
  const handleItemClick = useCallback(
    ({ data: action }: { data: string }) => {
      if (!clickItem) return;

      switch (action) {
        case 'info':
          Modal.info({
            title: trans_zh['image.modal.info.title'],
            content: <ObjTable obj={mergeMetaInfo(clickItem)} />,
          });
          break;
        case 'copy':
          copyImgLink(clickItem.realPath);
          break;
        case 'copyMarkdown':
          copyImgLink(clickItem.realPath, true, undefined, false);
          break;
        case 'copyMarkdownAbsolutely':
          copyImgLink(clickItem.realPath, true, undefined, true);
          break;
        case 'delete':
          Modal.confirm({
            title: trans_zh['image.modal.delete.title'],
            onOk: async () => {
              try {
                setLoading(true);
                await deleteImgBySign(clickItem.sign);
                setLoading(false);
                message.success(
                  `${trans_zh['image.message.delete.success1']}${
                    clickItem.storageType === 'picgo'
                      ? trans_zh['image.message.delete.success2']
                      : trans_zh['image.message.delete.success3']
                  }`,
                );
                fetchData();
              } catch (error) {
                console.error('Failed to delete image:', error);
                setLoading(false);
                message.error(trans_zh['image.message.delete.error']);
              }
            },
          });
          break;
        case 'download':
          downloadImg(clickItem.name, clickItem.realPath);
          break;
        case 'searchByLink':
          searchArtclesByLink(getImgLink(clickItem.realPath)).then((response) => {
            const articleResponse = response as ApiResponse<ArticleReference[]>;
            const articlesData = articleResponse.data || [];

            Modal.info({
              title: trans_zh['image.modal.reference.title'],
              content: (
                <table className="referenceTable">
                  <thead>
                    <tr>
                      <th>{trans_zh['image.table.column.id']}</th>
                      <th>{trans_zh['image.table.column.title']}</th>
                      <th>{trans_zh['image.table.column.actions']}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {articlesData.map((record: ArticleReference) => (
                      <tr key={record.id}>
                        <td>{record.id}</td>
                        <td>{record.title}</td>
                        <td>
                          <a
                            onClick={() => {
                              window.location.href = `/editor?type=article&id=${record.id}`;
                            }}
                          >
                            {trans_zh['image.action.edit']}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ),
            });
          });
          break;
        default:
          break;
      }
    },
    [clickItem, fetchData],
  );

  // Display menu method
  const displayMenu = useCallback((e: React.MouseEvent, item: StaticItem) => {
    setClickItem(item);
    // The show function is handled by the ContextMenuPortal component
  }, []);

  // Page change handler
  const handlePageChange = useCallback(
    (p: number, ps: number) => {
      if (ps !== pageSize) {
        if (typeof setPageSize === 'function') {
          setPageSize(ps);
        }
      }
      if (p !== page) {
        setPage(p);
      }
    },
    [page, pageSize, setPage, setPageSize],
  );

  return (
    <PageContainer
      className="t-0"
      header={{
        title: <TipTitle title={trans_zh['image.title']} tip={trans_zh['image.tip']} />,
      }}
      extra={
        <ActionButtons
          setLoading={setLoading}
          fetchData={fetchData}
          showDelAllBtn={showDelAllBtn}
        />
      }
    >
      <ContextMenuPortal showDelBtn={showDelBtn} handleItemClick={handleItemClick} />

      <RcResizeObserver
        key="resize-observer"
        onResize={(offset) => {
          const isSmall = offset.width <= 601;
          setResponsive(isSmall);
          if (isSmall !== responsive && typeof setPageSize === 'function') {
            setPageSize(isSmall ? 9 : 15);
          }
        }}
      >
        <div className="image-gallery-container">
          {loading ? (
            <Spin className="gallery-spinner" size="large" />
          ) : data.length === 0 ? (
            <Empty
              className="gallery-empty"
              description={trans_zh['image.empty.description'] || '没有图片'}
            />
          ) : (
            <ImageGrid data={data} responsive={responsive} displayMenu={displayMenu} />
          )}

          {total > 0 && !loading && (
            <PaginationComponent
              total={total}
              page={page}
              pageSize={pageSize as number}
              handlePageChange={handlePageChange}
            />
          )}
        </div>
      </RcResizeObserver>
    </PageContainer>
  );
};

export default ImageManager;
