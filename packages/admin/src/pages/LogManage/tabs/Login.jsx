import { getLog } from '@/services/van-blog/api';
import { useNum } from '@/services/van-blog/useNum';
import { ProTable } from '@ant-design/pro-components';
import React from 'react';
import { useTranslation } from 'react-i18next';

export default function () {
  const { t } = useTranslation();
  const [pageSize, setPageSize] = useNum(10, 'login-record-page-size');

  const columns = [
    {
      dataIndex: 'id',
      title: t('login.column.id'),
      search: false,
    },
    {
      dataIndex: 'createdAt',
      valueType: 'dateTime',
      title: t('login.column.createdAt'),
      sorter: true,
    },
    {
      dataIndex: 'ip',
      title: t('login.column.ip'),
      search: false,
    },
    {
      dataIndex: 'location',
      title: t('login.column.location'),
      search: false,
    },
    {
      title: t('login.column.range'),
      key: 'dateTimeRange',
      dataIndex: 'createdAt',
      valueType: 'dateTimeRange',
      hideInTable: true,
      search: {
        transform: (value) => {
          return {
            startTime: value?.[0],
            endTime: value?.[1],
          };
        },
      },
    },
    {
      title: t('login.column.time'),
      dataIndex: 'time',
      valueType: 'dateTime',
      hideInTable: true,
      search: {
        transform: (value) => {
          return {
            startTime: value,
            endTime: value,
          };
        },
      },
    },
    {
      dataIndex: 'username',
      title: t('login.column.username'),
      search: false,
    },
    {
      dataIndex: 'result',
      title: t('login.column.result'),
      valueEnum: {
        true: {
          text: t('login.status.success'),
          status: 'Success',
        },
        false: {
          text: t('login.status.fail'),
          status: 'Error',
        },
      },
    },
    {
      dataIndex: 'browser',
      title: t('login.column.userAgent'),
      search: false,
      ellipsis: true,
    },
  ];

  return (
    <>
      <ProTable
        columns={columns}
        request={async (params) => {
          try {
            const { data } = await getLog('login', params.current, params.pageSize);
            return {
              data: data?.data || [],
              success: Boolean(data),
              total: data?.total || 0,
            };
          } catch (error) {
            console.error('Error fetching login records:', error);
            return {
              data: [],
              success: false,
              total: 0,
              errorMessage: t('login.message.log.unavailable'),
            };
          }
        }}
        pagination={{
          pageSize: pageSize,
          onChange: (p, ps) => {
            if (ps != pageSize) {
              setPageSize(ps);
            }
          },
        }}
        rowKey="id"
        search={{
          labelWidth: 'auto',
          defaultCollapsed: false,
        }}
        dateFormatter="string"
        headerTitle={null}
        options={false}
      />
    </>
  );
}
