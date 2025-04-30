import { PageContainer } from '@ant-design/pro-layout';
import { Button, Modal, Space, Spin } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { history, useModel } from '@/utils/umiCompat';
import TipTitle from '../../components/TipTitle';

const trans_zh = {
  'comment.title': '评论管理',
  'comment.tip': '基于内嵌的 Waline，首个注册的用户即为管理员。未来会用自己的实现替代 Waline',
  'comment.button.setting': '设置',
  'comment.button.help': '帮助',
  'comment.modal.title': '使用说明',
  'comment.modal.content1': 'Vanblog 内嵌了',
  'comment.modal.waline': 'Waline',
  'comment.modal.content2': '作为评论系统。',
  'comment.modal.content3': '本管理页面也是内嵌的 Waline 后台管理页面。',
  'comment.modal.content4': '首次使用请先注册，首个注册的用户将默认成为管理员。',
  'comment.modal.content5':
    'PS: 评论功能默认开启，关闭请前往站点设置->系统设置->站点配置->高级设置->是否开启评论系统',
  'comment.modal.docs': '帮助文档',
};

export default function () {
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
      title: trans_zh['comment.modal.title'],
      content: (
        <div>
          <p>
            {trans_zh['comment.modal.content1']}{' '}
            <a target={'_blank'} rel="noreferrer" href="https://waline.js.org/">
              {trans_zh['comment.modal.waline']}
            </a>{' '}
            {trans_zh['comment.modal.content2']}
          </p>
          <p>{trans_zh['comment.modal.content3']}</p>
          <p>{trans_zh['comment.modal.content4']}</p>
          <p>{trans_zh['comment.modal.content5']}</p>
          <p>
            <a
              target={'_blank'}
              rel="noreferrer"
              href="https://vanblog.mereith.com/feature/basic/comment.html"
            >
              {trans_zh['comment.modal.docs']}
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
            {trans_zh['comment.button.setting']}
          </Button>
          <Button onClick={showTips}>{trans_zh['comment.button.help']}</Button>
        </Space>
      }
      header={{
        title: <TipTitle title={trans_zh['comment.title']} tip={trans_zh['comment.tip']} />,
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
