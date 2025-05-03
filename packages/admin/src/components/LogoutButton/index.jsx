import React from 'react';
import { useTranslation } from 'react-i18next';
import { logout } from '@/services/van-blog/api';
import { Modal, message } from 'antd';
import { history, ROUTES } from '@/router';

export default function ({ trigger }) {
  const { t } = useTranslation();
  // 执行退出函数
  const handleLogout = async () => {
    Modal.confirm({
      title: t('logout.modal.title'),
      okText: t('logout.modal.button.confirm'),
      cancelText: t('logout.modal.button.cancel'),
      async onOk() {
        try {
          await logout();
          window.localStorage.removeItem('token');
          message.success(t('logout.message.success'));
          history.push(ROUTES.LOGIN);
          return;
        } catch {
          // Even if logout API fails, remove token and redirect to login
          window.localStorage.removeItem('token');
          history.push(ROUTES.LOGIN);
          return;
        }
      },
    });
  };
  return <div onClick={handleLogout}>{trigger}</div>;
}
