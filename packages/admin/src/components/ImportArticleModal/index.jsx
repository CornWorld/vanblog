import React from 'react';
import { useTranslation } from 'react-i18next';
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

export default function (props) {
  const { t } = useTranslation();
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
        <Button key="button" type="primary" title={t('import.button.title')}>
          {t('import.button')}
        </Button>
      </Upload>
      <ModalForm
        form={form}
        title={t('import.modal.title')}
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
          label={t('import.title.label')}
          placeholder={t('import.title.placeholder')}
          rules={[{ required: true, message: t('import.required.message') }]}
        />
        <ProFormText
          width="md"
          id="top"
          name="top"
          label={t('import.toppriority.label')}
          placeholder={t('import.toppriority.placeholder')}
        />
        <ProFormSelect
          mode="tags"
          tokenSeparators={[',']}
          width="md"
          name="tags"
          label={t('import.tags.label')}
          placeholder={t('import.tags.placeholder')}
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
          label={t('import.category.label')}
          placeholder={t('import.category.placeholder')}
          tooltip={t('import.category.tooltip')}
          rules={[{ required: true, message: t('import.required.message') }]}
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
          label={t('import.createtime.label')}
        />
        <ProFormSelect
          width="md"
          name="private"
          id="private"
          label={t('import.private.label')}
          placeholder={t('import.private.placeholder')}
          request={async () => {
            return [
              {
                label: t('import.option.no'),
                value: false,
              },
              {
                label: t('import.option.yes'),
                value: true,
              },
            ];
          }}
        />
        <ProFormText.Password
          label={t('import.password.label')}
          width="md"
          id="password"
          name="password"
          autocomplete="new-password"
          placeholder={t('import.password.placeholder')}
          dependencies={['private']}
        />
        <ProFormSelect
          width="md"
          name="hidden"
          id="hidden"
          label={t('import.hidden.label')}
          placeholder={t('import.hidden.placeholder')}
          request={async () => {
            return [
              {
                label: t('import.option.no'),
                value: false,
              },
              {
                label: t('import.option.yes'),
                value: true,
              },
            ];
          }}
        />
        <ProFormTextArea
          name="content"
          label={t('import.content.label')}
          id="content"
          fieldProps={{ autoSize: { minRows: 3, maxRows: 5 } }}
        />
      </ModalForm>
    </>
  );
}
