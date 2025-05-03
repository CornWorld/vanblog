import React from 'react';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useMemo } from 'react';
import { useModel } from '@/router';
import { useLocation } from 'react-router-dom';
import './index.css';
import { ROUTES } from '@/router';

const Footer = () => {
  const { t } = useTranslation();
  const { initialState } = useModel();
  const { current } = useRef({ hasInit: false });
  const location = useLocation();
  const isInitPage = location.pathname.includes('/init');

  const version = useMemo(() => {
    if (isInitPage) return t('footer.initializing');
    let v = initialState?.version || t('footer.loading');
    if (location.pathname === ROUTES.LOGIN) {
      v = t('footer.login_required');
    }
    return v;
  }, [initialState, location, isInitPage, t]);

  useEffect(() => {
    if (!current.hasInit) {
      current.hasInit = true;
      if (!isInitPage) {
        console.log(t('footer.console.welcome'));
        console.log(t('footer.console.version'), version);
        console.log(t('footer.console.github'), 'https://github.com/CornWorld/vanblog');
        console.log(t('footer.console.fork_notice'));
        console.log(t('footer.console.star'));
      }
    }
  }, [initialState, version, isInitPage, current, t]);

  return (
    <>
      <div className="footer" style={{ textAlign: 'center', marginTop: 32 }}>
        <p>
          <span>{t('footer.powered_by')} </span>
          <a className="ua" href="https://vanblog.mereith.com" target="_blank" rel="noreferrer">
            VanBlog
          </a>
        </p>
        <p>
          <span>{t('footer.version')} </span>
          <span>{version}</span>
        </p>
      </div>
    </>
  );
};

export default Footer;
