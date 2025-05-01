import React from 'react';
import { useTranslation } from 'react-i18next';
import { Table, Typography } from 'antd';
import { useMemo } from 'react';

interface ObjTableProps {
  obj: Record<string, string>;
}

interface TableData {
  key: string;
  name: string;
  val: string;
}

export default function (props: ObjTableProps) {
  const { t } = useTranslation();
  const data = useMemo(() => {
    if (!props.obj || Object.keys(props.obj).length == 0) {
      return [];
    }
    const res: TableData[] = [];
    for (const [k, v] of Object.entries(props.obj)) {
      res.push({ key: k, name: k, val: v });
    }
    return res;
  }, [props]);
  return (
    <Table
      dataSource={data}
      size="small"
      columns={[
        { title: t('obj_table.column.property'), dataIndex: 'name', key: 'name', width: 60 },
        {
          title: t('obj_table.column.value'),
          dataIndex: 'val',
          key: 'val',
          render: (val) => {
            return (
              <Typography.Text
                copyable={val.length > 20}
                style={{ wordBreak: 'break-all', wordWrap: 'break-word' }}
              >
                {val}
              </Typography.Text>
            );
          },
        },
      ]}
      pagination={{
        hideOnSinglePage: true,
      }}
    ></Table>
  );
}
