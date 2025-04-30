import { getMenu, updateMenu } from '@/services/van-blog/api';
import { ActionType, ProColumns, EditableProTable } from '@ant-design/pro-components';
import { message, Modal, Spin } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Key } from 'react';

const trans_zh = {
  'menu.column.name': '菜单名',
  'menu.column.url': '跳转网址',
  'menu.column.url.tooltip': '内部地址需以 / 开头，外部地址请以协议开头( http/https )',
  'menu.column.actions': '操作',
  'menu.action.edit': '编辑',
  'menu.action.add_child': '新增下级',
  'menu.action.delete': '删除',
  'menu.message.max_level': '目前最大只支持二级菜单',
  'menu.modal.delete.title': '确认删除"{name}"吗?',
  'menu.table.header': '导航菜单管理',
  'menu.message.required': '此项为必填项',
};

interface MenuItem {
  id: string | number;
  name?: string;
  value: string;
  level: number;
  children?: MenuItem[];
}

const loopDataSourceFilter = (data: MenuItem[], id: React.Key | undefined): MenuItem[] => {
  return data
    .map((item) => {
      if (item.id !== id) {
        if (item.children) {
          const newChildren = loopDataSourceFilter(item.children, id);
          return {
            ...item,
            children: newChildren.length > 0 ? newChildren : undefined,
          };
        }
        return item;
      }
      return null;
    })
    .filter(Boolean) as MenuItem[];
};

export default function MenuTab() {
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<MenuItem[]>([]);
  const [editableKeys, setEditableRowKeys] = useState<(string | number)[]>([]);
  const [expendKeys, setExpendKeys] = useState<(string | number)[]>([]);
  const actionRef = useRef<ActionType | undefined>(undefined);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getMenu();
      const menuData = data?.data || [];
      setDataSource(menuData);
      const expendKs = menuData
        .filter((e: MenuItem) => Boolean(e.children))
        .map((e: MenuItem) => e.id);
      setExpendKeys(expendKs);
    } catch (error) {
      console.error('Failed to fetch menu data:', error);
      message.error('获取菜单数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const update = useCallback(
    async (vals: MenuItem[]) => {
      try {
        await updateMenu({ data: vals });
        fetchData();
      } catch (error) {
        console.error('Failed to update menu:', error);
        message.error('更新菜单失败');
      }
    },
    [fetchData],
  );

  const removeRow = useCallback(
    (record: MenuItem) => {
      const toUpdateData = loopDataSourceFilter(dataSource, record.id);
      setDataSource(toUpdateData);
      setEditableRowKeys(editableKeys.filter((e) => e !== record.id));
      setExpendKeys(expendKeys.filter((e) => e !== record.id));
      update(toUpdateData);
    },
    [dataSource, editableKeys, expendKeys, update],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getNewId = () => Date.now();

  const columns: ProColumns<MenuItem>[] = [
    {
      title: trans_zh['menu.column.name'],
      dataIndex: 'name',
      formItemProps: () => ({
        rules: [{ required: true, message: trans_zh['menu.message.required'] }],
      }),
    },
    {
      title: trans_zh['menu.column.url'],
      dataIndex: 'value',
      tooltip: trans_zh['menu.column.url.tooltip'],
      formItemProps: () => ({
        rules: [{ required: true, message: trans_zh['menu.message.required'] }],
      }),
    },
    {
      title: trans_zh['menu.column.actions'],
      valueType: 'option',
      key: 'option',
      width: 200,
      render: (_text, record, _index, action) => [
        <a
          key="editable"
          onClick={() => {
            action?.startEditable?.(record.id);
          }}
        >
          {trans_zh['menu.action.edit']}
        </a>,
        record.level === 0 ? (
          <a
            key="addChild"
            onClick={() => {
              if (record.level >= 1) {
                message.warning(trans_zh['menu.message.max_level']);
                return;
              }

              const children = record?.children || [];
              const newId = getNewId();
              children.push({
                id: newId,
                level: record.level + 1,
                value: '',
              });

              const newData = dataSource.map((d) => {
                if (d.id === record.id) {
                  return {
                    ...record,
                    children,
                  };
                }
                return d;
              });
              setDataSource(newData);
              setExpendKeys([...expendKeys, record.id]);
              action?.startEditable(newId);
            }}
          >
            {trans_zh['menu.action.add_child']}
          </a>
        ) : undefined,
        <a
          key="delete"
          onClick={() => {
            Modal.confirm({
              onOk: () => {
                removeRow(record);
              },
              title: trans_zh['menu.modal.delete.title'].replace('{name}', record.name || '-'),
            });
          }}
        >
          {trans_zh['menu.action.delete']}
        </a>,
      ],
    },
  ];

  return (
    <Spin spinning={loading}>
      <EditableProTable<MenuItem>
        expandable={{
          defaultExpandAllRows: true,
          expandedRowKeys: expendKeys,
          onExpand: (expanded, record) => {
            if (expanded) {
              setExpendKeys([...expendKeys, record.id]);
            } else {
              setExpendKeys(expendKeys.filter((e) => e !== record.id));
            }
          },
        }}
        actionRef={actionRef}
        rowKey="id"
        headerTitle={trans_zh['menu.table.header']}
        scroll={{
          x: 960,
        }}
        recordCreatorProps={{
          position: 'bottom',
          record: () => ({ id: getNewId(), level: 0, value: '' }),
        }}
        loading={false}
        columns={columns}
        value={dataSource}
        onChange={(value) => setDataSource([...value])}
        editable={{
          type: 'multiple',
          editableKeys,
          onSave: async () => {
            try {
              await update(dataSource);
            } catch (error) {
              console.error('Failed to save menu changes:', error);
            }
          },
          onDelete: async (_, row) => {
            removeRow(row);
          },
          onChange: (keys: Key[]) => setEditableRowKeys(keys as (string | number)[]),
        }}
      />
    </Spin>
  );
}
