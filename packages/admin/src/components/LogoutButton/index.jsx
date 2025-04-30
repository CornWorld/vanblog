import { logout } from '@/services/van-blog/api';
import { Modal, message } from 'antd';
import { history } from '@/utils/umiCompat';
import { ROUTES } from '@/utils/routes';

const trans_zh = {
  'logout.modal.title': '确定要退出登录吗？',
  'logout.modal.button.confirm': '确认',
  'logout.modal.button.cancel': '取消',
  'logout.message.success': '退出登录成功！',
};

export default function ({ trigger }) {
  // 执行退出函数
  const handleLogout = async () => {
    Modal.confirm({
      title: trans_zh['logout.modal.title'],
      okText: trans_zh['logout.modal.button.confirm'],
      cancelText: trans_zh['logout.modal.button.cancel'],
      async onOk() {
        try {
          await logout();
          window.localStorage.removeItem('token');
          message.success(trans_zh['logout.message.success']);
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
