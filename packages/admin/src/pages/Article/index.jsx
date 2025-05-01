import React, { useMemo, useRef, useState } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import ProTable from '@ant-design/pro-table';
import RcResizeObserver from 'rc-resize-observer';
import { Button, message, Space } from 'antd';
import { history } from '@/router';
import { useTranslation } from 'react-i18next';
import { getArticlesByOption } from '@/services/van-blog/api';
import { batchExport, batchDelete } from '@/services/van-blog/batch';
import { useNum } from '@/services/van-blog/useNum';
import { articleObjAll, articleObjSmall, columns } from './columns';
import ImportArticleModal from '@/components/ImportArticleModal';
import NewArticleModal from '@/components/NewArticleModal';

export default () => {
  const { t } = useTranslation();
  const actionRef = useRef();
  const [colKeys, setColKeys] = useState(articleObjAll);
  const [simplePage, setSimplePage] = useState(false);
  const [simpleSearch, setSimpleSearch] = useState(false);
  const [pageSize, setPageSize] = useNum(10, 'article-page-size');
  const searchSpan = useMemo(() => {
    if (!simpleSearch) {
      return 8;
    } else {
      return 24;
    }
  }, [simpleSearch]);
  return (
    <PageContainer
      title={null}
      extra={null}
      ghost
      className="t-8"
      header={{ title: null, extra: null, ghost: true }}
    >
      <RcResizeObserver
        key="resize-observer"
        onResize={(offset) => {
          const r = offset.width < 1000;

          setSimpleSearch(offset.width < 750);
          setSimplePage(offset.width < 600);
          if (r) {
            setColKeys(articleObjSmall);
          } else {
            setColKeys(articleObjAll);
          }
          //  小屏幕的话把默认的 col keys 删掉一些
        }}
      >
        <ProTable
          columns={columns}
          actionRef={actionRef}
          cardBordered
          rowSelection={{
            fixed: true,
            preserveSelectedRowKeys: true,
          }}
          tableAlertOptionRender={({ selectedRowKeys, onCleanSelected }) => {
            return (
              <Space>
                <a
                  onClick={async () => {
                    await batchDelete(selectedRowKeys);
                    message.success(t('article.message.batch_delete_success'));
                    actionRef.current.reload();
                    onCleanSelected();
                  }}
                >
                  {t('article.action.batch_delete')}
                </a>
                <a
                  onClick={() => {
                    batchExport(selectedRowKeys);
                    onCleanSelected();
                  }}
                >
                  {t('article.action.batch_export')}
                </a>
                <a onClick={onCleanSelected}>{t('article.action.cancel_select')}</a>
              </Space>
            );
          }}
          request={async (params = {}, sort) => {
            const option = {};
            if (sort.createdAt) {
              if (sort.createdAt == 'ascend') {
                option.sortCreatedAt = 'asc';
              } else {
                option.sortCreatedAt = 'desc';
              }
            }
            if (sort.top) {
              if (sort.top == 'ascend') {
                option.sortTop = 'asc';
              } else {
                option.sortTop = 'desc';
              }
            }
            if (sort.viewer) {
              if (sort.viewer == 'ascend') {
                option.sortViewer = 'asc';
              } else {
                option.sortViewer = 'desc';
              }
            }

            // 搜索
            const { current, pageSize, ...searchObj } = params;
            if (searchObj) {
              for (const [targetName, target] of Object.entries(searchObj)) {
                switch (targetName) {
                  case 'title':
                    if (target.trim() != '') {
                      option.title = target;
                    }
                    break;
                  case 'tags':
                    if (target.trim() != '') {
                      option.tags = target;
                    }
                    break;
                  case 'endTime':
                    if (searchObj?.startTime) {
                      option.startTime = searchObj?.startTime;
                    }
                    if (searchObj?.endTime) {
                      option.endTime = searchObj?.endTime;
                    }
                    break;
                  case 'category':
                    if (target.trim() != '') {
                      option.category = target;
                    }
                    break;
                }
              }
            }
            option.page = current;
            option.pageSize = pageSize;
            const { data } = await getArticlesByOption(option);
            const { articles, total } = data;
            return {
              data: articles,
              // success 请返回 true，
              // 不然 table 会停止解析数据，即使有数据
              success: Boolean(data),
              // 不传会使用 data 的长度，如果是分页一定要传
              total: total,
            };
          }}
          editable={false}
          columnsState={{
            // persistenceKey: 'van-blog-article-table',
            // persistenceType: 'localStorage',
            value: colKeys,
            onChange(value) {
              setColKeys(value);
            },
          }}
          rowKey="id"
          search={{
            labelWidth: 'auto',
            span: searchSpan,
            className: 'searchCard',
          }}
          pagination={{
            pageSize: pageSize,
            simple: simplePage,
            onChange: (p, ps) => {
              if (ps != pageSize) {
                setPageSize(ps);
              }
            },
          }}
          dateFormatter="string"
          headerTitle={simpleSearch ? undefined : t('article.title')}
          options={simpleSearch ? false : true}
          toolBarRender={() => [
            <Button
              key="editAboutMe"
              onClick={() => {
                history.push(`/editor?type=about&id=${0}`);
              }}
            >
              {t('article.action.edit_about')}
            </Button>,
            <NewArticleModal
              key="newArticle123"
              onFinish={(data) => {
                actionRef?.current?.reload();
                history.push(`/editor?type=article&id=${data.id}`);
              }}
            />,
            <ImportArticleModal
              key="importArticleBtn"
              onFinish={() => {
                actionRef?.current?.reload();
                message.success(t('article.message.import_success'));
              }}
            />,
          ]}
        />
      </RcResizeObserver>
    </PageContainer>
  );
};
