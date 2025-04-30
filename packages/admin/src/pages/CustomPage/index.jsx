import CustomPageModal from '@/components/CustomPageModal';
import { deleteCustomPageByPath, getCustomPages } from '@/services/van-blog/api';
import { ProTable } from '@ant-design/pro-components';
import { Button, Card, message, Modal, Space } from 'antd';
import { useRef } from 'react';
import { Link } from '@/router';

const trans_zh = {
  'custompage.column.index': '序号',
  'custompage.column.name': '名称',
  'custompage.column.type': '类型',
  'custompage.column.type.file': '单文件页面',
  'custompage.column.type.folder': '多文件页面',
  'custompage.column.path': '路径',
  'custompage.column.actions': '操作',
  'custompage.action.edit_content': '编辑内容',
  'custompage.action.file_manage': '文件管理',
  'custompage.action.view': '查看',
  'custompage.action.edit_info': '修改信息',
  'custompage.action.delete': '删除',
  'custompage.modal.demo.title': '演示站不可修改此项！',
  'custompage.modal.delete.title': '删除确认',
  'custompage.modal.delete.content': '是否确认删除该自定义页面？',
  'custompage.message.delete.success': '删除成功！',
  'custompage.title': '自定义页面',
  'custompage.button.new': '新建',
  'custompage.button.help': '帮助',
  'custompage.message.new.success': '新建成功！',
  'custompage.modal.help.title': '帮助',
  'custompage.modal.help.content1': '自定义页面可以添加页面到 /c 路径下。',
  'custompage.modal.help.content2': '自定义页面分为两种：单文件页面、多文件页面。',
  'custompage.modal.help.content3':
    '前者可直接通过后台内置编辑器编辑其 HTML 内容，比较省事、后者需要上传相关的文件，适合复杂页面。',
  'custompage.modal.help.content4': '多文件页面后续会演进成"文件管理"功能～',
  'custompage.modal.help.docs': '帮助文档',
};

const columns = [
  {
    title: trans_zh['custompage.column.index'],
    render: (_, record, index) => {
      return index;
    },
  },
  { dataIndex: 'name', title: trans_zh['custompage.column.name'] },
  {
    dataIndex: 'type',
    title: trans_zh['custompage.column.type'],
    valueType: 'select',
    valueEnum: {
      file: {
        text: trans_zh['custompage.column.type.file'],
        status: 'Default',
      },
      folder: {
        text: trans_zh['custompage.column.type.folder'],
        status: 'Success',
      },
    },
  },
  { dataIndex: 'path', title: trans_zh['custompage.column.path'] },
  {
    title: trans_zh['custompage.column.actions'],
    render: (_, record) => {
      return (
        <Link
          to={
            record.type == 'file'
              ? `/code?type=file&lang=html&path=${record.path}`
              : `/code?type=folder&path=${record.path}`
          }
        >
          {record.type == 'file'
            ? trans_zh['custompage.action.edit_content']
            : trans_zh['custompage.action.file_manage']}
        </Link>
      );
    },
  },
  {
    title: trans_zh['custompage.column.path'],
    render: (_, record, __, action) => {
      return (
        <Space>
          <a key="view" target="_blank" rel="noreferrer" href={`/c${record.path}`}>
            {trans_zh['custompage.action.view']}
          </a>

          <CustomPageModal
            key={'editInfo'}
            trigger={<a>{trans_zh['custompage.action.edit_info']}</a>}
            initialValues={record}
            onFinish={() => {
              action?.reload();
            }}
          ></CustomPageModal>
          <a
            key="delete"
            onClick={() => {
              if (location.hostname == 'blog-demo.mereith.com') {
                Modal.info({
                  title: trans_zh['custompage.modal.demo.title'],
                });
                return;
              }
              Modal.confirm({
                title: trans_zh['custompage.modal.delete.title'],
                content: trans_zh['custompage.modal.delete.content'],
                onOk: async () => {
                  await deleteCustomPageByPath(record.path);
                  action?.reload();
                  message.success(trans_zh['custompage.message.delete.success']);
                },
              });
            }}
          >
            {trans_zh['custompage.action.delete']}
          </a>
        </Space>
      );
    },
  },
];

export default function () {
  // const [loading, setLoading] = useState(true);
  const actionRef = useRef();

  const handleHelp = () => {
    Modal.info({
      title: trans_zh['custompage.modal.help.title'],
      content: (
        <div>
          <p>{trans_zh['custompage.modal.help.content1']}</p>
          <p>{trans_zh['custompage.modal.help.content2']}</p>
          <p>{trans_zh['custompage.modal.help.content3']}</p>
          <p>{trans_zh['custompage.modal.help.content4']}</p>
          <a
            target="_blank"
            href="https://vanblog.mereith.com/feature/advance/customPage.html"
            rel="noreferrer"
          >
            {trans_zh['custompage.modal.help.docs']}
          </a>
        </div>
      ),
    });
  };

  return (
    <>
      <Card
        className="card-body-full"
        title={trans_zh['custompage.title']}
        extra={
          <Space>
            <CustomPageModal
              trigger={<Button type="primary">{trans_zh['custompage.button.new']}</Button>}
              onFinish={() => {
                actionRef.current?.reload();
                message.success(trans_zh['custompage.message.new.success']);
              }}
            />
            <Button type="link" key="help" onClick={handleHelp}>
              {trans_zh['custompage.button.help']}
            </Button>
          </Space>
        }
      >
        <ProTable
          rowKey="_id"
          columns={columns}
          dateFormatter="string"
          actionRef={actionRef}
          search={false}
          options={false}
          pagination={{
            hideOnSinglePage: true,
            simple: true,
          }}
          request={async () => {
            let { data } = await getCustomPages();
            return {
              data,
              // success 请返回 true，
              // 不然 table 会停止解析数据，即使有数据
              success: true,
              // 不传会使用 data 的长度，如果是分页一定要传
              total: data.length,
            };
          }}
        />
      </Card>
    </>
  );
}
