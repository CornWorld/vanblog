import React from 'react';
import i18next from 'i18next';
import { ProFormSelect } from '@ant-design/pro-form';
import { getAllCollaboratorsList } from '@/services/van-blog/api';

export default () => (
  <ProFormSelect
    width="md"
    id="author"
    name="author"
    label={i18next.t('author_field.label')}
    placeholder={i18next.t('author_field.placeholder')}
    request={async () =>
      (await getAllCollaboratorsList())?.data?.map(({ name, nickname = name }) => ({
        label: nickname,
        value: nickname,
      })) || []
    }
  />
);
