import React from 'react';
import { useTranslation } from 'react-i18next';
import { PageContainer } from '@ant-design/pro-layout';
import { Button, Modal, Space, Spin } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { history, useModel } from '@/router';
import TipTitle from '../../components/TipTitle';

export default function () {
  const { t } = useTranslation();
  const { initialState } = useModel('@@initialState');
  const [loading, setLoading] = useState(true);
  const { current } = useRef({ hasInit: false });
  const src = useMemo(() => {
    if (initialState?.version && initialState?.version == 'dev') {
      return 'http://192.168.5.11:8360/ui';
    } else {
      return '/ui/';
    }
  }, [initialState]);
  const showTips = () => {
    Modal.info({
      title: t('comment.modal.title'),
      content: (
        <div>
          <p>
            {t('comment.modal.content1')}{' '}
            <a target={'_blank'} rel="noreferrer" href="https://waline.js.org/">
              {t('comment.modal.waline')}
            </a>{' '}
            {t('comment.modal.content2')}
          </p>
          <p>{t('comment.modal.content3')}</p>
          <p>{t('comment.modal.content4')}</p>
          <p>{t('comment.modal.content5')}</p>
          <p>
            <a
              target={'_blank'}
              rel="noreferrer"
              href="https://vanblog.mereith.com/feature/basic/comment.html"
            >
              {t('comment.modal.docs')}
            </a>
          </p>
        </div>
      ),
    });
  };
  useEffect(() => {
    if (!current.hasInit) {
      current.hasInit = true;
      if (!localStorage.getItem('CommentTipped')) {
        localStorage.setItem('CommentTipped', true);
        showTips();
      }
    }
  }, [current]);
  return (
    <PageContainer
      className="editor-full"
      style={{ overflow: 'hidden' }}
      title={null}
      extra={
        <Space>
          <Button
            type="primary"
            onClick={() => {
              history.push(`/site/setting?tab=waline`);
            }}
          >
            {t('comment.button.setting')}
          </Button>
          <Button onClick={showTips}>{t('comment.button.help')}</Button>
        </Space>
      }
      header={{
        title: <TipTitle title={t('comment.title')} tip={t('comment.tip')} />,
      }}
    >
      <Spin spinning={loading}>
        <iframe
          onLoad={() => {
            setLoading(false);
          }}
          title="waline 后台"
          src={src}
          width="100%"
          height={'100%'}
        ></iframe>
      </Spin>
    </PageContainer>
  );
}
