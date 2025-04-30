import { getLog, getPipelineConfig } from '@/services/van-blog/api';
import { ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import { Modal, Tag } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { history } from '@/router';
import type { AlignType } from 'rc-table/lib/interface';

const trans_zh = {
  'pipeline.table.index': '序号',
  'pipeline.table.id': '流水线 id',
  'pipeline.table.name': '名称',
  'pipeline.table.event': '触发事件',
  'pipeline.table.result': '结果',
  'pipeline.table.result.success': '成功',
  'pipeline.table.result.fail': '失败',
  'pipeline.table.detail': '详情',
  'pipeline.modal.title': '详情',
  'pipeline.modal.logs': '脚本日志：',
  'pipeline.modal.input': '输入：',
  'pipeline.modal.output': '输出：',
  'pipeline.header.title': '流水线日志',
};

interface PipelineRecord {
  pipelineId: string;
  pipelineName: string;
  eventName: string;
  success: boolean;
  logs: string[];
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  time?: string;
}

interface PipelineConfig {
  eventName: string;
  eventNameChinese: string;
}

interface LogResponse {
  data: PipelineRecord[];
  total: number;
}

export default function Pipeline() {
  const actionRef = useRef<ActionType>();
  const [pipelineConfig, setPipelineConfig] = useState<PipelineConfig[]>([]);

  useEffect(() => {
    getPipelineConfig().then((response) => {
      if (response && typeof response === 'object' && 'data' in response) {
        setPipelineConfig(response.data as PipelineConfig[]);
      }
    });
  }, []);

  const columns: ProColumns<PipelineRecord>[] = [
    {
      title: trans_zh['pipeline.table.index'],
      align: 'center' as AlignType,
      width: 50,
      render: (_, __, index) => index + 1,
    },
    {
      title: trans_zh['pipeline.table.id'],
      dataIndex: 'pipelineId',
      key: 'pipelineId',
      align: 'center' as AlignType,
    },
    {
      title: trans_zh['pipeline.table.name'],
      dataIndex: 'pipelineName',
      key: 'pipelineName',
      align: 'center' as AlignType,
      render: (_, record) => (
        <a
          onClick={() => {
            history.push('/code?type=pipeline&id=' + record.pipelineId);
          }}
        >
          {record.pipelineName}
        </a>
      ),
    },
    {
      title: trans_zh['pipeline.table.event'],
      dataIndex: 'eventName',
      key: 'eventName',
      align: 'center' as AlignType,
      render: (_, record) => (
        <Tag color="blue">
          {pipelineConfig?.find((item) => item.eventName === record.eventName)?.eventNameChinese}
        </Tag>
      ),
    },
    {
      title: trans_zh['pipeline.table.result'],
      dataIndex: 'success',
      key: 'success',
      align: 'center' as AlignType,
      render: (_, record) =>
        record.success ? (
          <Tag color="green">{trans_zh['pipeline.table.result.success']}</Tag>
        ) : (
          <Tag color="red">{trans_zh['pipeline.table.result.fail']}</Tag>
        ),
    },
    {
      title: trans_zh['pipeline.table.detail'],
      dataIndex: 'detail',
      key: 'detail',
      render: (_, record) => (
        <a
          onClick={() => {
            Modal.info({
              title: trans_zh['pipeline.modal.title'],
              width: 800,
              content: (
                <div
                  style={{
                    maxHeight: '60vh',
                    overflow: 'auto',
                  }}
                >
                  <p>{trans_zh['pipeline.modal.logs']}</p>
                  <pre>
                    {record.logs.map((l, i) => (
                      <p key={i}>{l}</p>
                    ))}
                  </pre>
                  <p>{trans_zh['pipeline.modal.input']}</p>
                  <pre>{JSON.stringify(record.input, null, 2)}</pre>
                  <p>{trans_zh['pipeline.modal.output']}</p>
                  <pre>{JSON.stringify(record.output, null, 2)}</pre>
                </div>
              ),
            });
          }}
        >
          {trans_zh['pipeline.table.detail']}
        </a>
      ),
    },
  ];

  return (
    <>
      <ProTable<PipelineRecord>
        cardBordered
        rowKey="time"
        columns={columns}
        search={false}
        dateFormatter="string"
        actionRef={actionRef}
        options={false}
        headerTitle={trans_zh['pipeline.header.title']}
        pagination={{
          pageSize: 10,
          simple: true,
          hideOnSinglePage: true,
        }}
        request={async (params) => {
          const response = await getLog('runPipeline', params.current, params.pageSize);

          if (response && typeof response === 'object' && 'data' in response) {
            const logData = response.data as LogResponse;
            return {
              data: logData.data || [],
              success: true,
              total: logData.total || 0,
            };
          }

          return {
            data: [],
            success: true,
            total: 0,
          };
        }}
      />
    </>
  );
}
