import '../styles/globals.css';
import '../styles/side-bar.css';
import '../styles/toc.css';
import '../styles/var.css';
import '../styles/github-markdown.css';
import '../styles/tip-card.css';
import '../styles/loader.css';
import '../styles/scrollbar.css';
import '../styles/custom-container.css';
import '../styles/code-light.css';
import '../styles/code-dark.css';
import '../styles/zoom.css';
import type { AppProps } from 'next/app';
import { GlobalContext, GlobalState } from '../utils/globalContext';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { getPageview, updatePageview } from '../api/pageView';
import Head from 'next/head';
import { appWithTranslation } from 'next-i18next';
import { PageViewDataContract, normalizePageViewData } from '../types/contracts';
import { createLogger } from '../utils/logger';

const logger = createLogger('App');

type AppPropsWithPageViewData = AppProps & {
  pageProps: {
    pageViewData?: PageViewDataContract;
  };
};

function MyApp({ Component, pageProps }: AppPropsWithPageViewData) {
  const { current } = useRef({ hasInit: false });

  // Initialize state with normalized server-side data
  const normalizedPageViewData = normalizePageViewData(pageProps.pageViewData);
  const [globalState, setGlobalState] = useState<GlobalState>({
    viewer: normalizedPageViewData.viewer,
    visited: normalizedPageViewData.visited,
  });

  const router = useRouter();

  // Function to update pageview on client-side navigation
  const updateClientPageview = useCallback(async (reason: string) => {
    // Skip if running during SSR/SSG
    if (typeof window === 'undefined') return;

    try {
      const { pathname } = window.location;
      if (window.localStorage.getItem('noViewer')) {
        try {
          const { viewer, visited } = await getPageview(pathname);
          setGlobalState((prev) => ({ ...prev, viewer, visited }));
        } catch (error) {
          logger.error('Failed to get pageview:', error);
          // Don't update state on error to keep previous values
        }
      } else {
        logger.info('更新访客:', reason, pathname);
        try {
          const { viewer, visited } = await updatePageview(pathname);
          setGlobalState((prev) => ({ ...prev, viewer, visited }));
        } catch (error) {
          logger.error('Failed to update pageview:', error);
          // Don't update state on error to keep previous values
        }
      }
    } catch (error) {
      logger.error('Error in updateClientPageview:', error);
      // Prevent the error from affecting the user experience
    }
  }, []);

  const handleRouteChange = useCallback(
    (url: string, { shallow }: { shallow: boolean }) => {
      if (!shallow) {
        updateClientPageview(`页面跳转`);
      }
    },
    [updateClientPageview],
  );

  useEffect(() => {
    if (!current.hasInit) {
      current.hasInit = true;

      // Only update pageview if we didn't receive server data
      if (!pageProps.pageViewData) {
        updateClientPageview('初始化');
      }

      router.events.on('routeChangeComplete', handleRouteChange);

      return () => {
        router.events.off('routeChangeComplete', handleRouteChange);
      };
    }
  }, [current, updateClientPageview, router.events, handleRouteChange, pageProps.pageViewData]);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
      </Head>
      <GlobalContext.Provider value={{ state: globalState, setState: setGlobalState }}>
        <Component {...pageProps} />
      </GlobalContext.Provider>
    </>
  );
}

export default appWithTranslation(MyApp);
