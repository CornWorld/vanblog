import Script from 'next/script';
import { useEffect, useRef } from 'react';

// Define a type for the Baidu analytics object
interface HmtObject {
  push: (arg: unknown) => void;
  [key: number]: unknown;
}

interface RefObject {
  hasInit: boolean;
}

export default function BaiduAnalysis(props: { id: string }) {
  const { current } = useRef<RefObject>({ hasInit: false });

  useEffect(() => {
    if (!current.hasInit && props.id !== '') {
      current.hasInit = true;
      const _hmt: HmtObject = (window as Window & { _hmt?: HmtObject })._hmt || [];
      // Initialize _hmt for tracking
      _hmt.push(['_setAutoPageview', true]);
    }
  }, [current, props]);

  return (
    <>{props.id !== '' && <Script src={`https://hm.baidu.com/hm.js?${props.id}`} async></Script>}</>
  );
}
