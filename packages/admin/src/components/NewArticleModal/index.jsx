import React from 'react';
import { useTranslation } from 'react-i18next';
import { createArticle, getAllCategories, getTags } from '@/services/van-blog/api';
import {
  ModalForm,
  ProFormDateTimePicker,
  ProFormSelect,
  ProFormText,
} from '@ant-design/pro-components';
import { Button, Modal } from 'antd';
import dayjs from '@/utils/dayjs';
import AuthorField from '../AuthorField';

export default function (props) {
  const { t } = useTranslation();
  const { onFinish } = props;
  return (
    <ModalForm
      title={t('new_article.title')}
      trigger={
        <Button key="button" type="primary">
          {t('new_article.button')}
        </Button>
      }
      width={450}
      autoFocusFirstInput
      submitTimeout={3000}
      onFinish={async (values) => {
        if (location.hostname == 'blog-demo.mereith.com') {
          Modal.info({
            title: t('new_article.modal.demo.title'),
            content: t('new_article.modal.demo.content'),
          });
          return;
        }
        const washedValues = {};
        for (const [k, v] of Object.entries(values)) {
          washedValues[k.replace('C', '')] = v;
        }

        const { data } = await createArticle(washedValues);
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
        label={t('new_article.field.title')}
        placeholder={t('new_article.field.title.placeholder')}
        rules={[{ required: true, message: t('new_article.field.required') }]}
      />
      <AuthorField />
      <ProFormText
        width="md"
        id="topC"
        name="topC"
        label={t('new_article.field.top')}
        placeholder={t('new_article.field.top.placeholder')}
      />
      <ProFormText
        width="md"
        id="pathnameC"
        name="pathnameC"
        label={t('new_article.field.pathname')}
        tooltip={t('new_article.field.pathname.tooltip')}
        placeholder={t('new_article.field.pathname.placeholder')}
      />
      <ProFormSelect
        mode="tags"
        tokenSeparators={[',']}
        width="md"
        name="tagsC"
        label={t('new_article.field.tags')}
        placeholder={t('new_article.field.tags.placeholder')}
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
        tooltip={t('new_article.field.category.tooltip')}
        label={t('new_article.field.category')}
        placeholder={t('new_article.field.category.placeholder')}
        rules={[{ required: true, message: t('new_article.field.required') }]}
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
        placeholder={t('new_article.field.created_at.placeholder')}
        name="createdAtC"
        id="createdAtC"
        label={t('new_article.field.created_at')}
        width="md"
        showTime={{
          defaultValue: dayjs('00:00:00', 'HH:mm:ss'),
        }}
      />

      <ProFormSelect
        width="md"
        name="privateC"
        id="privateC"
        label={t('new_article.field.private')}
        placeholder={t('new_article.field.private.placeholder')}
        request={async () => {
          return [
            {
              label: t('new_article.field.private.no'),
              value: false,
            },
            {
              label: t('new_article.field.private.yes'),
              value: true,
            },
          ];
        }}
      />
      <ProFormText.Password
        label={t('new_article.field.password')}
        width="md"
        id="passwordC"
        name="passwordC"
        autocomplete="new-password"
        placeholder={t('new_article.field.password.placeholder')}
        dependencies={['private']}
      />
      <ProFormSelect
        width="md"
        name="hiddenC"
        id="hiddenC"
        label={t('new_article.field.hidden')}
        placeholder={t('new_article.field.hidden.placeholder')}
        request={async () => {
          return [
            {
              label: t('new_article.field.hidden.no'),
              value: false,
            },
            {
              label: t('new_article.field.hidden.yes'),
              value: true,
            },
          ];
        }}
      />
      <ProFormText
        width="md"
        id="copyrightC"
        name="copyrightC"
        label={t('new_article.field.copyright')}
        tooltip={t('new_article.field.copyright.tooltip')}
        placeholder={t('new_article.field.copyright.placeholder')}
      />
    </ModalForm>
  );
}
