import { createArticle, getAllCategories, getTags } from '@/services/van-blog/api';
import { parseMarkdownFile } from '@/services/van-blog/parseMarkdownFile';
import {
  ModalForm,
  ProFormDateTimePicker,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { Button, Form, Upload } from 'antd';
import dayjs from '@/utils/dayjs';
import { useState } from 'react';

const trans_zh = {
  'import.button': '导入',
  'import.button.title': '从 markdown 文件导入，可多选',
  'import.modal.title': '导入文章',
  'import.title.label': '文章标题',
  'import.title.placeholder': '请输入标题',
  'import.required.message': '这是必填项',
  'import.toppriority.label': '置顶优先级',
  'import.toppriority.placeholder': '留空或0表示不置顶，其余数字越大表示优先级越高',
  'import.tags.label': '标签',
  'import.tags.placeholder': '请选择或输入标签',
  'import.category.label': '分类',
  'import.category.placeholder': '请选择分类',
  'import.category.tooltip': '首次使用请先在站点管理-数据管理-分类管理中添加分类',
  'import.createtime.label': '创建时间',
  'import.private.label': '是否加密',
  'import.private.placeholder': '是否加密',
  'import.option.no': '否',
  'import.option.yes': '是',
  'import.password.label': '密码',
  'import.password.placeholder': '请输入密码',
  'import.hidden.label': '是否隐藏',
  'import.hidden.placeholder': '是否隐藏',
  'import.content.label': '内容',
};

export default function (props) {
  const { onFinish } = props;
  const [visible, setVisible] = useState(false);
  const [form] = Form.useForm();
  const handleUpload = async (file) => {
    const vals = await parseMarkdownFile(file);
    if (vals) {
      await createArticle(vals);
    }
  };
  const beforeUpload = async (file, files) => {
    if (files.length > 1) {
      await handleUpload(file);
      if (files[files.length - 1] == file) {
        if (onFinish) {
          onFinish();
        }
      }
    } else {
      const vals = await parseMarkdownFile(file);
      form.setFieldsValue(vals);
      setVisible(true);
    }
  };
  return (
    <>
      <Upload showUploadList={false} multiple={true} accept={'.md'} beforeUpload={beforeUpload}>
        <Button key="button" type="primary" title={trans_zh['import.button.title']}>
          {trans_zh['import.button']}
        </Button>
      </Upload>
      <ModalForm
        form={form}
        title={trans_zh['import.modal.title']}
        visible={visible}
        onVisibleChange={(v) => {
          setVisible(v);
        }}
        width={450}
        autoFocusFirstInput
        submitTimeout={3000}
        onFinish={async (values) => {
          const washedValues = {};
          for (const [k, v] of Object.entries(values)) {
            washedValues[k.replace('C', '')] = v;
          }

          await createArticle(washedValues);
          if (onFinish) {
            onFinish();
          }

          return true;
        }}
        layout="horizontal"
        labelCol={{ span: 6 }}
        // wrapperCol: { span: 14 },
      >
        <ProFormText
          width="md"
          required
          id="title"
          name="title"
          label={trans_zh['import.title.label']}
          placeholder={trans_zh['import.title.placeholder']}
          rules={[{ required: true, message: trans_zh['import.required.message'] }]}
        />
        <ProFormText
          width="md"
          id="top"
          name="top"
          label={trans_zh['import.toppriority.label']}
          placeholder={trans_zh['import.toppriority.placeholder']}
        />
        <ProFormSelect
          mode="tags"
          tokenSeparators={[',']}
          width="md"
          name="tags"
          label={trans_zh['import.tags.label']}
          placeholder={trans_zh['import.tags.placeholder']}
          request={async () => {
            const msg = await getTags();
            return msg?.data?.map((item) => ({ label: item, value: item })) || [];
          }}
        />
        <ProFormSelect
          width="md"
          required
          id="category"
          name="category"
          label={trans_zh['import.category.label']}
          placeholder={trans_zh['import.category.placeholder']}
          tooltip={trans_zh['import.category.tooltip']}
          rules={[{ required: true, message: trans_zh['import.required.message'] }]}
          request={async () => {
            const { data: categories } = await getAllCategories();
            return categories?.map((e) => {
              return {
                label: e,
                value: e,
              };
            });
          }}
        />
        <ProFormDateTimePicker
          showTime={{
            defaultValue: dayjs('00:00:00', 'HH:mm:ss'),
          }}
          width="md"
          name="createdAt"
          id="createdAt"
          label={trans_zh['import.createtime.label']}
        />
        <ProFormSelect
          width="md"
          name="private"
          id="private"
          label={trans_zh['import.private.label']}
          placeholder={trans_zh['import.private.placeholder']}
          request={async () => {
            return [
              {
                label: trans_zh['import.option.no'],
                value: false,
              },
              {
                label: trans_zh['import.option.yes'],
                value: true,
              },
            ];
          }}
        />
        <ProFormText.Password
          label={trans_zh['import.password.label']}
          width="md"
          id="password"
          name="password"
          autocomplete="new-password"
          placeholder={trans_zh['import.password.placeholder']}
          dependencies={['private']}
        />
        <ProFormSelect
          width="md"
          name="hidden"
          id="hidden"
          label={trans_zh['import.hidden.label']}
          placeholder={trans_zh['import.hidden.placeholder']}
          request={async () => {
            return [
              {
                label: trans_zh['import.option.no'],
                value: false,
              },
              {
                label: trans_zh['import.option.yes'],
                value: true,
              },
            ];
          }}
        />
        <ProFormTextArea
          name="content"
          label={trans_zh['import.content.label']}
          id="content"
          fieldProps={{ autoSize: { minRows: 3, maxRows: 5 } }}
        />
      </ModalForm>
    </>
  );
}
