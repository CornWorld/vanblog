import { isMac, isMobileByScreenSize } from '@/services/van-blog/ua';
import { useMemo } from 'react';

const trans_zh = {
  'savetip.save': '保存',
  'savetip.save_mac': '保存 ⌘ + S',
  'savetip.save_win': '保存 Ctrl + S',
};

export const SaveTip = () => {
  const text = useMemo(() => {
    if (isMobileByScreenSize()) {
      return trans_zh['savetip.save'];
    } else {
      if (isMac()) {
        return trans_zh['savetip.save_mac'];
      } else {
        return trans_zh['savetip.save_win'];
      }
    }
  }, []);
  return <span>{text}</span>;
};
