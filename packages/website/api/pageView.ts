import { apiService } from './service';
import { PageViewDataContract, createDefaultPageViewData } from '../types/contracts';
import Logger from '../utils/logger';

const DEFAULT_PAGEVIEW_RESPONSE: PageViewDataContract = createDefaultPageViewData();

export type { PageViewDataContract as PageViewData };

// Accept an optional pathname for backward compatibility; it's intentionally unused here.
export const getPageview = async (..._args: [pathname?: string]): Promise<PageViewDataContract> => {
  // Mark arguments as used to satisfy eslint no-unused-vars
  void _args;
  try {
    return await apiService.getPageView();
  } catch (err) {
    Logger.error('[PageView] Error getting pageview:', err);
    return DEFAULT_PAGEVIEW_RESPONSE;
  }
};

// Server-side-compatible version of pageview
export const getServerPageview = async (): Promise<PageViewDataContract> => {
  try {
    return await apiService.getPageView();
  } catch (err) {
    Logger.error('[PageView] Error getting server pageview:', err);
    return DEFAULT_PAGEVIEW_RESPONSE;
  }
};

// Client-side only function to update pageviews
export const updatePageview = async (pathname: string): Promise<PageViewDataContract> => {
  const hasVisited = window.localStorage.getItem('visited') === 'true';
  const hasVisitedCurrentPath = window.localStorage.getItem(`visited-${pathname}`) === 'true';

  if (!hasVisited) {
    window.localStorage.setItem('visited', 'true');
  }

  if (!hasVisitedCurrentPath) {
    window.localStorage.setItem(`visited-${pathname}`, 'true');
  }

  try {
    const options = {
      isNew: !hasVisited,
      isNewByPath: !hasVisitedCurrentPath,
    };

    try {
      return await apiService.updatePageView(options);
    } catch (err) {
      Logger.error('[PageView] Error updating pageview:', err);
      // Fallback to getting current pageview data
      return await apiService.getPageView();
    }
  } catch (err) {
    Logger.error('[PageView] Error in updatePageview:', err);
    return DEFAULT_PAGEVIEW_RESPONSE;
  }
};
