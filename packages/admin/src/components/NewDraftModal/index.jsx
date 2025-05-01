import React from 'react';
import { useTranslation } from 'react-i18next';
import { createDraft, getAllCategories, getTags } from '@/services/van-blog/api';
import {
  ModalForm,
  ProFormDateTimePicker,
  ProFormSelect,
  ProFormText,
} from '@ant-design/pro-components';
import { Button } from 'antd';
import dayjs from '@/utils/dayjs';
import AuthorField from '../AuthorField';

export default function (props) {
  const { t } = useTranslation();
  const { onFinish } = props;
  return (
    <ModalForm
      title={t('new_draft.modal.title')}
      trigger={
        <Button key="button" type="primary">
          {t('new_draft.button')}
        </Button>
      }
      width={450}
      autoFocusFirstInput
      submitTimeout={3000}
      onFinish={async (values) => {
        const washedValues = {};
        for (const [k, v] of Object.entries(values)) {
          washedValues[k.replace('C', '')] = v;
        }

        const { data } = await createDraft(washedValues);
        if (onFinish) {
          onFinish(data);
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
        id="titleC"
        name="titleC"
        label={t('new_draft.field.title')}
        placeholder={t('new_draft.field.title.placeholder')}
        rules={[{ required: true, message: t('new_draft.field.required') }]}
      />
      <AuthorField />
      <ProFormSelect
        mode="tags"
        tokenSeparators={[',']}
        width="md"
        name="tagsC"
        label={t('new_draft.field.tags')}
        placeholder={t('new_draft.field.tags.placeholder')}
        request={async () => {
          const msg = await getTags();
          return msg?.data?.map((item) => ({ label: item, value: item })) || [];
        }}
      />
      <ProFormSelect
        width="md"
        required
        id="categoryC"
        name="categoryC"
        label={t('new_draft.field.category')}
        tooltip={t('new_draft.field.category.tooltip')}
        placeholder={t('new_draft.field.category.placeholder')}
        rules={[{ required: true, message: t('new_draft.field.required') }]}
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
        name="createdAtC"
        id="createdAtC"
        label={t('new_draft.field.created_at')}
        placeholder={t('new_draft.field.created_at.placeholder')}
        showTime={{
          defaultValue: dayjs('00:00:00', 'HH:mm:ss'),
        }}
      />
    </ModalForm>
  );
}
