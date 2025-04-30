import { getLog } from '@/services/van-blog/api';
import { useNum } from '@/services/van-blog/useNum';
import { ProTable } from '@ant-design/pro-components';
import React from 'react';

const trans_zh = {
  'login.column.id': 'ID',
  'login.column.createdAt': '登录时间',
  'login.column.ip': 'IP',
  'login.column.location': '地理位置',
  'login.column.range': '时间范围',
  'login.column.time': '时间',
  'login.message.log.unavailable': '无此数据',
  'login.status.success': '成功',
  'login.status.fail': '失败',
  'login.column.username': '用户名',
  'login.column.result': '结果',
  'login.column.userAgent': '浏览器 UA',
};

export default function () {
  const [pageSize, setPageSize] = useNum(10, 'login-record-page-size');

  const columns = [
    {
      dataIndex: 'id',
      title: trans_zh['login.column.id'],
      search: false,
    },
    {
      dataIndex: 'createdAt',
      valueType: 'dateTime',
      title: trans_zh['login.column.createdAt'],
      sorter: true,
    },
    {
      dataIndex: 'ip',
      title: trans_zh['login.column.ip'],
      search: false,
    },
    {
      dataIndex: 'location',
      title: trans_zh['login.column.location'],
      search: false,
    },
    {
      title: trans_zh['login.column.range'],
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
      title: trans_zh['login.column.time'],
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
      title: trans_zh['login.column.username'],
      search: false,
    },
    {
      dataIndex: 'result',
      title: trans_zh['login.column.result'],
      valueEnum: {
        true: {
          text: trans_zh['login.status.success'],
          status: 'Success',
        },
        false: {
          text: trans_zh['login.status.fail'],
          status: 'Error',
        },
      },
    },
    {
      dataIndex: 'browser',
      title: trans_zh['login.column.userAgent'],
      search: false,
      ellipsis: true,
    },
  ];

  return (
    <>
      <ProTable
        columns={columns}
        request={async (params, sort) => {
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
              errorMessage: trans_zh['login.message.log.unavailable'],
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
