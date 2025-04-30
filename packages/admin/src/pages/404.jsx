import { Button, Result } from 'antd';
import React from 'react';

const trans_zh = {
  'error.404.title': '404',
  'error.404.subtitle': '抱歉，您访问的页面不存在。',
  'error.404.button': '返回首页',
};

export default () => (
  <Result
    status="404"
    title={trans_zh['error.404.title']}
    subTitle={trans_zh['error.404.subtitle']}
    extra={
      <Button type="primary" href="/">
        {trans_zh['error.404.button']}
      </Button>
    }
  />
);
