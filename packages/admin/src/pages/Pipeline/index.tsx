import React from 'react';
import { useTranslation } from 'react-i18next';
import TipTitle from '@/components/TipTitle';
import { PageContainer } from '@ant-design/pro-layout';
import ProTable, { ActionType } from '@ant-design/pro-table';
import { Button, message, Modal, Space, Tag } from 'antd';
import { getPiplelines, getPipelineConfig, deletePipelineById } from '@/services/van-blog/api';
import PipelineModal from './components/PipelineModal';
import { useEffect, useRef, useState } from 'react';
import { history } from '@/router';

interface PipelineConfig {
  eventName: string;
  eventNameChinese: string;
  passive: boolean;
}

interface Pipeline {
  id: number;
  name: string;
  eventName: string;
  enabled: boolean;
}

export default function () {
  const { t } = useTranslation();
  const [pipelineConfig, setPipelineConfig] = useState<PipelineConfig[]>([]);
  const actionRef = useRef<ActionType>();

  useEffect(() => {
    getPipelineConfig().then(({ data }) => {
      setPipelineConfig(data);
    });
  }, []);

  const columns = [
    {
      dataIndex: 'id',
      valueType: 'number',
      title: t('pipeline.column.id'),
      width: 48,
    },
    {
      dataIndex: 'name',
      valueType: 'text',
      title: t('pipeline.column.name'),
      width: 120,
    },
    {
      title: t('pipeline.column.is_async'),
      width: 60,
      render: (_, record: Pipeline) => {
        const passive = pipelineConfig.find((item) => item.eventName === record.eventName)?.passive;
        return (
          <Tag
            children={
              passive ? t('pipeline.column.is_async.yes') : t('pipeline.column.is_async.no')
            }
            color={passive ? 'green' : 'red'}
          />
        );
      },
    },
    {
      dataIndex: 'eventName',
      valueType: 'text',
      title: t('pipeline.column.event'),
      width: 120,
      render: (eventName: string) => {
        return pipelineConfig.find((item) => item.eventName === eventName)?.eventNameChinese;
      },
    },
    {
      dataIndex: 'enabled',
      title: t('pipeline.column.status'),
      width: 60,
      render: (enabled: boolean) => (
        <Tag
          children={
            enabled ? t('pipeline.column.status.enabled') : t('pipeline.column.status.disabled')
          }
          color={enabled ? 'green' : 'gray'}
        />
      ),
    },
    {
      title: t('pipeline.column.actions'),
      width: 180,
      render: (_, record: Pipeline) => {
        return (
          <>
            <Space>
              <a
                onClick={() => {
                  history.push('/code?type=pipeline&id=' + record.id);
                }}
              >
                {t('pipeline.action.edit_script')}
              </a>
              <PipelineModal
                mode="edit"
                trigger={<a>{t('pipeline.action.edit_info')}</a>}
                initialValues={record}
                onFinish={() => {
                  actionRef.current?.reload();
                }}
              />

              <a
                onClick={async () => {
                  Modal.confirm({
                    title: t('pipeline.modal.delete.title'),
                    onOk: async () => {
                      await deletePipelineById(record.id);
                      if (actionRef.current) {
                        actionRef.current.reload();
                      }
                      message.success(t('pipeline.message.delete.success'));
                    },
                  });
                }}
              >
                {t('pipeline.action.delete')}
              </a>
            </Space>
          </>
        );
      },
    },
  ];

  return (
    <PageContainer
      header={{
        title: <TipTitle title={t('pipeline.title')} tip={t('pipeline.tip')} />,
      }}
      extra={
        <Button
          onClick={() => {
            window.open('https://vanblog.mereith.com/features/pipeline.html', '_blank');
          }}
        >
          {t('pipeline.button.docs')}
        </Button>
      }
    >
      <ProTable
        actionRef={actionRef}
        pagination={{
          hideOnSinglePage: true,
        }}
        toolBarRender={(action) => {
          return [
            <PipelineModal
              mode="create"
              key="createPipelineBtn1"
              trigger={<Button type="primary">{t('pipeline.button.new')}</Button>}
              onFinish={() => {
                action.reload();
              }}
            />,
            <Button
              key="viewLog"
              onClick={() => {
                history.push('/site/log?tab=pipeline');
              }}
            >
              {t('pipeline.button.logs')}
            </Button>,
          ];
        }}
        headerTitle={t('pipeline.table.title')}
        columns={columns}
        search={false}
        rowKey="id"
        request={async () => {
          const data = await getPiplelines();
          return {
            data: data.data,
            success: true,
            total: data.data.length,
          };
        }}
      />
    </PageContainer>
  );
}
