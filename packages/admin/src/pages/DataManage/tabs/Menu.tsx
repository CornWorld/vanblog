import { useTranslation } from 'react-i18next';
import { getMenu, updateMenu } from '@/services/van-blog/api';
import { EditableProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import { message, Modal, Spin } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Key } from 'react';

interface MenuItem {
  id: string | number;
  name?: string;
  path: string;
  icon?: string;
  external?: boolean;
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

/** Strip transient fields (id) before sending to backend */
const toNavigation = (
  items: MenuItem[],
): Array<{
  name: string;
  path: string;
  icon?: string;
  external?: boolean;
  children?: unknown[];
}> => {
  return items.map(({ name, path, icon, external, children }) => ({
    name: name ?? '',
    path,
    ...(icon ? { icon } : {}),
    ...(external ? { external } : {}),
    ...(children && children.length > 0 ? { children: toNavigation(children) } : {}),
  }));
};

export default function MenuTab() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<MenuItem[]>([]);
  const [editableKeys, setEditableRowKeys] = useState<(string | number)[]>([]);
  const [expendKeys, setExpendKeys] = useState<(string | number)[]>([]);
  const actionRef = useRef<ActionType | undefined>(undefined);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMenu();
      const menuData = (Array.isArray(data) ? data : []).map(
        (item: Record<string, unknown>, index: number) => ({
          id: index,
          ...item,
        }),
      ) as MenuItem[];
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
        await updateMenu(toNavigation(vals));
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
      title: t('menu.column.name'),
      dataIndex: 'name',
      formItemProps: () => ({
        rules: [{ required: true, message: t('menu.message.required') }],
      }),
    },
    {
      title: t('menu.column.url'),
      dataIndex: 'path',
      tooltip: t('menu.column.url.tooltip'),
      formItemProps: () => ({
        rules: [{ required: true, message: t('menu.message.required') }],
      }),
    },
    {
      title: t('menu.column.actions'),
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
          {t('menu.action.edit')}
        </a>,
        !record.children || record.children.length === 0 ? (
          <a
            key="addChild"
            onClick={() => {
              const children = record?.children || [];
              const newId = getNewId();
              children.push({
                id: newId,
                path: '',
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
            {t('menu.action.add_child')}
          </a>
        ) : undefined,
        <a
          key="delete"
          onClick={() => {
            Modal.confirm({
              onOk: () => {
                removeRow(record);
              },
              title: t('menu.modal.delete.title', { name: record.name || '-' }),
            });
          }}
        >
          {t('menu.action.delete')}
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
        headerTitle={t('menu.table.header')}
        scroll={{
          x: 960,
        }}
        recordCreatorProps={{
          position: 'bottom',
          record: () => ({ id: getNewId(), path: '' }),
        }}
        loading={false}
        columns={columns}
        value={dataSource}
        onChange={(value) => setDataSource([...value])}
        editable={{
          type: 'multiple',
          editableKeys,
          onSave: async (rowKey, record) => {
            try {
              // Merge the saved row into the current dataSource.
              // For new rows (not yet in dataSource), append them.
              let found = false;
              const mergeRow = (items: MenuItem[]): MenuItem[] =>
                items.map((item) => {
                  if (item.id === rowKey) {
                    found = true;
                    return { ...item, ...record } as MenuItem;
                  }
                  if (item.children) {
                    return { ...item, children: mergeRow(item.children) };
                  }
                  return item;
                });
              let merged = mergeRow(dataSource);
              if (!found) {
                merged = [...merged, { ...record, id: rowKey } as MenuItem];
              }
              setDataSource(merged);
              await update(merged);
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
