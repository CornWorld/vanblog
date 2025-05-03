import '@ant-design/v5-patch-for-react-19';
import './i18n';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/lib/locale/zh_CN';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import './global.less';
import './utils/dayjs'; // Import the dayjs config, no need to assign it to a variable

// Base path for admin routes
const basename = '/admin';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <BrowserRouter basename={basename}>
    <ConfigProvider locale={zhCN}>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </ConfigProvider>
  </BrowserRouter>,
);
