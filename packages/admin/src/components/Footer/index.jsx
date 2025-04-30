import { useEffect, useRef, useMemo } from 'react';
import { useModel } from '@/utils/umiCompat';
import { useLocation } from 'react-router-dom';
import './index.css';

const trans_zh = {
  'footer.powered_by': 'Powered By',
  'footer.version': '版本:',
  'footer.initializing': '初始化中...',
  'footer.loading': '获取中...',
  'footer.login_required': '登录后显示',
  'footer.console.welcome': '✨ Welcome to VanBlog Website ✨',
  'footer.console.version': 'Version:',
  'footer.console.github': 'GitHub:',
  'footer.console.fork_notice':
    '!!! This is a fork of VanBlog, and is not the official website. !!!',
  'footer.console.star': 'If you like this project, please give it a star! 🌟',
};

const Footer = () => {
  const { initialState } = useModel();
  const { current } = useRef({ hasInit: false });
  const location = useLocation();
  const isInitPage = location.pathname.includes('/init');

  const version = useMemo(() => {
    if (isInitPage) return trans_zh['footer.initializing'];
    let v = initialState?.version || trans_zh['footer.loading'];
    if (location.pathname === '/user/login') {
      v = trans_zh['footer.login_required'];
    }
    return v;
  }, [initialState, location, isInitPage]);

  useEffect(() => {
    if (!current.hasInit) {
      current.hasInit = true;
      if (!isInitPage) {
        console.log(trans_zh['footer.console.welcome']);
        console.log(trans_zh['footer.console.version'], version);
        console.log(trans_zh['footer.console.github'], 'https://github.com/CornWorld/vanblog');
        console.log(trans_zh['footer.console.fork_notice']);
        console.log(trans_zh['footer.console.star']);
      }
    }
  }, [initialState, version, isInitPage]);

  return (
    <>
      <div className="footer" style={{ textAlign: 'center', marginTop: 32 }}>
        <p>
          <span>{trans_zh['footer.powered_by']} </span>
          <a className="ua" href="https://vanblog.mereith.com" target="_blank" rel="noreferrer">
            VanBlog
          </a>
        </p>
        <p>
          <span>{trans_zh['footer.version']} </span>
          <span>{version}</span>
        </p>
      </div>
    </>
  );
};

export default Footer;
