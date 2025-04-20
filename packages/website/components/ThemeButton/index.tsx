import { useContext, useEffect, useLayoutEffect, useRef } from 'react';
import { applyTheme, getTheme, initTheme } from '../../utils/theme';
import { RealThemeType, ThemeContext } from '../../utils/themeContext';
import { useTranslation } from 'next-i18next';
import { LightIcon, DarkIcon, AutoIcon } from './icons';

export type ThemeType = 'auto' | 'dark' | 'light';

interface ThemeButtonProps {
  defaultTheme: ThemeType;
}

interface ThemeRef {
  hasInit: boolean;
}

interface TimerRef {
  timer: NodeJS.Timeout | null;
}

// Use regular useEffect for browser-only code
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export default function ThemeButton(props: ThemeButtonProps) {
  const { t } = useTranslation();
  const { current } = useRef<ThemeRef>({ hasInit: false });
  const { current: currentTimer } = useRef<TimerRef>({ timer: null });
  const { theme, setTheme: setThemeState } = useContext(ThemeContext);

  const setTheme = (newTheme: ThemeType) => {
    if (typeof window === 'undefined') return;

    clearTimer();
    localStorage.setItem('theme', newTheme);
    // realTheme include auto-light or auto-dark
    const realTheme = getTheme(newTheme === 'auto' ? 'auto-light' : (newTheme as RealThemeType));
    applyTheme(realTheme);
    setThemeState(realTheme);
    if (realTheme.includes('auto')) {
      setTimer();
    }
  };

  const clearTimer = () => {
    if (currentTimer.timer) {
      clearInterval(currentTimer.timer);
      currentTimer.timer = null;
    }
  };

  const setTimer = () => {
    clearTimer();
    currentTimer.timer = setInterval(() => {
      const realTheme = getTheme('auto-light');
      applyTheme(realTheme);
    }, 10000);
  };

  // Use isomorphic layout effect to prevent SSR issues
  useIsomorphicLayoutEffect(() => {
    if (!current.hasInit && typeof window !== 'undefined') {
      current.hasInit = true;
      if (!localStorage.getItem('theme')) {
        // 第一次用默认的
        setTheme(props.defaultTheme);
        clearTimer();
      } else {
        const iTheme = initTheme();
        setTheme(iTheme as ThemeType);
        clearTimer();
      }
    }
    return () => {
      if (currentTimer.timer) {
        clearInterval(currentTimer.timer);
      }
    };
  }, [current, props, currentTimer, theme]);

  const handleSwitch = () => {
    const order: ThemeType[] = ['auto', 'light', 'dark'];
    const easyTheme: ThemeType = theme.includes('auto') ? 'auto' : (theme as ThemeType);
    const currentIndex = order.indexOf(easyTheme);
    const nextIndex = (currentIndex + 1) % order.length;
    setTheme(order[nextIndex]);
  };

  const toSmallCamel = (str: string) => {
    return str.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
  };

  return (
    <div
      className="flex items-center cursor-pointer hover:scale-125 transform transition-all mr-4 ml-4 sm:ml-2 lg:ml-6"
      onClick={handleSwitch}
    >
      <div
        className="dark:text-dark text-gray-600"
        title={theme.includes('auto') ? t('theme.' + toSmallCamel(theme)) : t('theme.' + theme)}
      >
        {theme === 'light' && <LightIcon />}
        {theme === 'dark' && <DarkIcon />}
        {theme.includes('auto') && <AutoIcon />}
      </div>
    </div>
  );
}
