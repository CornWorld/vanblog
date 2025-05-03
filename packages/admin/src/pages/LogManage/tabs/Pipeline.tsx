import React from 'react';
import { useTranslation } from 'react-i18next';
import { getLog, getPipelineConfig } from '@/services/van-blog/api';
import { ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import { Modal, Tag } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { history } from '@/router';
import type { AlignType } from 'rc-table/lib/interface';

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
  const { t } = useTranslation();
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
      title: t('pipeline.table.index'),
      align: 'center' as AlignType,
      width: 50,
      render: (_, __, index) => index + 1,
    },
    {
      title: t('pipeline.table.id'),
      dataIndex: 'pipelineId',
      key: 'pipelineId',
      align: 'center' as AlignType,
    },
    {
      title: t('pipeline.table.name'),
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
      title: t('pipeline.table.event'),
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
      title: t('pipeline.table.result'),
      dataIndex: 'success',
      key: 'success',
      align: 'center' as AlignType,
      render: (_, record) =>
        record.success ? (
          <Tag color="green">{t('pipeline.table.result.success')}</Tag>
        ) : (
          <Tag color="red">{t('pipeline.table.result.fail')}</Tag>
        ),
    },
    {
      title: t('pipeline.table.detail'),
      dataIndex: 'detail',
      key: 'detail',
      render: (_, record) => (
        <a
          onClick={() => {
            Modal.info({
              title: t('pipeline.modal.title'),
              width: 800,
              content: (
                <div
                  style={{
                    maxHeight: '60vh',
                    overflow: 'auto',
                  }}
                >
                  <p>{t('pipeline.modal.logs')}</p>
                  <pre>
                    {record.logs.map((l, i) => (
                      <p key={i}>{l}</p>
                    ))}
                  </pre>
                  <p>{t('pipeline.modal.input')}</p>
                  <pre>{JSON.stringify(record.input, null, 2)}</pre>
                  <p>{t('pipeline.modal.output')}</p>
                  <pre>{JSON.stringify(record.output, null, 2)}</pre>
                </div>
              ),
            });
          }}
        >
          {t('pipeline.table.detail')}
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
        headerTitle={t('pipeline.header.title')}
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
