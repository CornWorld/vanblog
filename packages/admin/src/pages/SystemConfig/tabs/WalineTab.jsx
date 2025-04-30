const trans_zh = {
  'comment.settings': '评论设置',
  'comment.form.description': '本表单可以控制内嵌 waline 评论系统的配置。具体请参考：',
  'comment.help.doc': '帮助文档',
};

import WalineForm from '@/components/WalineForm';
import { Alert, Card } from 'antd';

export default function () {
  return (
    <>
      <Card title={trans_zh['comment.settings']}>
        <Alert
          type="info"
          message={
            <div>
              <p>
                <span>{trans_zh['comment.form.description']}</span>
                <a
                  target={'_blank'}
                  rel="noreferrer"
                  href="https://vanblog.mereith.com/feature/basic/comment.html"
                >
                  {trans_zh['comment.help.doc']}
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
