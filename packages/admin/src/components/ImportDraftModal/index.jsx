import { createDraft, getAllCategories, getTags } from '@/services/van-blog/api';
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
  'import_draft.button': '导入',
  'import_draft.button.title': '从 markdown 文件导入，可多选',
  'import_draft.modal.title': '导入草稿',
  'import_draft.field.title': '文章标题',
  'import_draft.field.title.placeholder': '请输入标题',
  'import_draft.field.required': '这是必填项',
  'import_draft.field.tags': '标签',
  'import_draft.field.tags.placeholder': '请选择或输入标签',
  'import_draft.field.category': '分类',
  'import_draft.field.category.placeholder': '请选择分类',
  'import_draft.field.category.tooltip': '首次使用请先在站点管理-数据管理-分类管理中添加分类',
  'import_draft.field.created_at': '创建时间',
  'import_draft.field.content': '内容',
};

export default function (props) {
  const { onFinish } = props;
  const [visible, setVisible] = useState(false);
  const [form] = Form.useForm();
  const handleUpload = async (file) => {
    const vals = await parseMarkdownFile(file);
    if (vals) {
      await createDraft(vals);
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
        <Button key="button" type="primary" title={trans_zh['import_draft.button.title']}>
          {trans_zh['import_draft.button']}
        </Button>
      </Upload>
      <ModalForm
        form={form}
        title={trans_zh['import_draft.modal.title']}
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

          await createDraft(washedValues);
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
          label={trans_zh['import_draft.field.title']}
          placeholder={trans_zh['import_draft.field.title.placeholder']}
          rules={[{ required: true, message: trans_zh['import_draft.field.required'] }]}
        />
        <ProFormSelect
          mode="tags"
          tokenSeparators={[',']}
          width="md"
          name="tags"
          label={trans_zh['import_draft.field.tags']}
          placeholder={trans_zh['import_draft.field.tags.placeholder']}
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
          label={trans_zh['import_draft.field.category']}
          placeholder={trans_zh['import_draft.field.category.placeholder']}
          tooltip={trans_zh['import_draft.field.category.tooltip']}
          rules={[{ required: true, message: trans_zh['import_draft.field.required'] }]}
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
          width="md"
          name="createdAt"
          id="createdAt"
          label={trans_zh['import_draft.field.created_at']}
          showTime={{
            defaultValue: dayjs('00:00:00', 'HH:mm:ss'),
          }}
        />
        <ProFormTextArea
          name="content"
          label={trans_zh['import_draft.field.content']}
          id="content"
          fieldProps={{ autoSize: { minRows: 3, maxRows: 5 } }}
        />
      </ModalForm>
    </>
  );
}
