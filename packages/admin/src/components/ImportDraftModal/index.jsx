import React from 'react';
import { useTranslation } from 'react-i18next';
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

export default function (props) {
  const { t } = useTranslation();
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
        <Button key="button" type="primary" title={t('import_draft.button.title')}>
          {t('import_draft.button')}
        </Button>
      </Upload>
      <ModalForm
        form={form}
        title={t('import_draft.modal.title')}
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
          label={t('import_draft.field.title')}
          placeholder={t('import_draft.field.title.placeholder')}
          rules={[{ required: true, message: t('import_draft.field.required') }]}
        />
        <ProFormSelect
          mode="tags"
          tokenSeparators={[',']}
          width="md"
          name="tags"
          label={t('import_draft.field.tags')}
          placeholder={t('import_draft.field.tags.placeholder')}
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
          label={t('import_draft.field.category')}
          placeholder={t('import_draft.field.category.placeholder')}
          tooltip={t('import_draft.field.category.tooltip')}
          rules={[{ required: true, message: t('import_draft.field.required') }]}
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
          label={t('import_draft.field.created_at')}
          showTime={{
            defaultValue: dayjs('00:00:00', 'HH:mm:ss'),
          }}
        />
        <ProFormTextArea
          name="content"
          label={t('import_draft.field.content')}
          id="content"
          fieldProps={{ autoSize: { minRows: 3, maxRows: 5 } }}
        />
      </ModalForm>
    </>
  );
}
