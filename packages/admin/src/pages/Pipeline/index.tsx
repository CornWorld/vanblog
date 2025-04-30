import TipTitle from '@/components/TipTitle';
import { PageContainer } from '@ant-design/pro-layout';
import ProTable, { ActionType } from '@ant-design/pro-table';
import { Button, message, Modal, Space, Tag } from 'antd';
import { getPiplelines, getPipelineConfig, deletePipelineById } from '@/services/van-blog/api';
import PipelineModal from './components/PipelineModal';
import { useEffect, useRef, useState } from 'react';
import { history } from '@/router';

const trans_zh = {
  'pipeline.title': '流水线',
  'pipeline.tip': '流水线允许用户在特定事件时，自动触发执行自定义代码。',
  'pipeline.column.id': 'ID',
  'pipeline.column.name': '名称',
  'pipeline.column.is_async': '是否异步',
  'pipeline.column.is_async.yes': '异步',
  'pipeline.column.is_async.no': '阻塞',
  'pipeline.column.event': '触发事件',
  'pipeline.column.status': '状态',
  'pipeline.column.status.enabled': '启用',
  'pipeline.column.status.disabled': '禁用',
  'pipeline.column.actions': '操作',
  'pipeline.action.edit_script': '编辑脚本',
  'pipeline.action.edit_info': '修改信息',
  'pipeline.action.delete': '删除',
  'pipeline.modal.delete.title': '确定删除该流水线吗？ ',
  'pipeline.message.delete.success': '删除成功！',
  'pipeline.button.docs': '帮助文档',
  'pipeline.table.title': '流水线列表',
  'pipeline.button.new': '新建',
  'pipeline.button.logs': '运行日志',
};

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
      title: trans_zh['pipeline.column.id'],
      width: 48,
    },
    {
      dataIndex: 'name',
      valueType: 'text',
      title: trans_zh['pipeline.column.name'],
      width: 120,
    },
    {
      title: trans_zh['pipeline.column.is_async'],
      width: 60,
      render: (_, record: Pipeline) => {
        const passive = pipelineConfig.find((item) => item.eventName === record.eventName)?.passive;
        return (
          <Tag
            children={
              passive
                ? trans_zh['pipeline.column.is_async.yes']
                : trans_zh['pipeline.column.is_async.no']
            }
            color={passive ? 'green' : 'red'}
          />
        );
      },
    },
    {
      dataIndex: 'eventName',
      valueType: 'text',
      title: trans_zh['pipeline.column.event'],
      width: 120,
      render: (eventName: string) => {
        return pipelineConfig.find((item) => item.eventName === eventName)?.eventNameChinese;
      },
    },
    {
      dataIndex: 'enabled',
      title: trans_zh['pipeline.column.status'],
      width: 60,
      render: (enabled: boolean) => (
        <Tag
          children={
            enabled
              ? trans_zh['pipeline.column.status.enabled']
              : trans_zh['pipeline.column.status.disabled']
          }
          color={enabled ? 'green' : 'gray'}
        />
      ),
    },
    {
      title: trans_zh['pipeline.column.actions'],
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
                {trans_zh['pipeline.action.edit_script']}
              </a>
              <PipelineModal
                mode="edit"
                trigger={<a>{trans_zh['pipeline.action.edit_info']}</a>}
                initialValues={record}
                onFinish={() => {
                  actionRef.current?.reload();
                }}
              />

              <a
                onClick={async () => {
                  Modal.confirm({
                    title: trans_zh['pipeline.modal.delete.title'],
                    onOk: async () => {
                      await deletePipelineById(record.id);
                      if (actionRef.current) {
                        actionRef.current.reload();
                      }
                      message.success(trans_zh['pipeline.message.delete.success']);
                    },
                  });
                }}
              >
                {trans_zh['pipeline.action.delete']}
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
        title: <TipTitle title={trans_zh['pipeline.title']} tip={trans_zh['pipeline.tip']} />,
      }}
      extra={
        <Button
          onClick={() => {
            window.open('https://vanblog.mereith.com/features/pipeline.html', '_blank');
          }}
        >
          {trans_zh['pipeline.button.docs']}
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
              trigger={<Button type="primary">{trans_zh['pipeline.button.new']}</Button>}
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
              {trans_zh['pipeline.button.logs']}
            </Button>,
          ];
        }}
        headerTitle={trans_zh['pipeline.table.title']}
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
