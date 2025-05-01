import { Button, Result } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';

export default () => {
  const { t } = useTranslation();

  return (
    <Result
      status="404"
      title={t('error.404.title')}
      subTitle={t('error.404.subtitle')}
      extra={
        <Button type="primary" href="/">
          {t('error.404.button')}
        </Button>
      }
    />
  );
};
