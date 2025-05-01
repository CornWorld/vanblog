import React from 'react';
import { useTranslation } from 'react-i18next';

import WalineForm from '@/components/WalineForm';
import { Alert, Card } from 'antd';

export default function () {
  const { t } = useTranslation();
  return (
    <>
      <Card title={t('comment.settings')}>
        <Alert
          type="info"
          message={
            <div>
              <p>
                <span>{t('comment.form.description')}</span>
                <a
                  target={'_blank'}
                  rel="noreferrer"
                  href="https://vanblog.mereith.com/feature/basic/comment.html"
                >
                  {t('comment.help.doc')}
                </a>
              </p>
            </div>
          }
          style={{ marginBottom: 20 }}
        />
        <WalineForm />
      </Card>
    </>
  );
}
