import React from 'react';
import i18next from 'i18next';
import { isMac, isMobileByScreenSize } from '@/services/van-blog/ua';
import { useMemo } from 'react';

export const SaveTip = () => {
  const text = useMemo(() => {
    if (isMobileByScreenSize()) {
      return i18next.t('savetip.save');
    } else {
      if (isMac()) {
        return i18next.t('savetip.save_mac');
      } else {
        return i18next.t('savetip.save_win');
      }
    }
  }, []);
  return <span>{text}</span>;
};
