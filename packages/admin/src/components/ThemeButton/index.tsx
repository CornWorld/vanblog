import { useEffect } from 'react';
import { useModel } from '@/router';
import { readTheme, setTheme } from '@/utils/theme';
import { applyThemeToDOM, decodeAutoTheme } from '@/services/van-blog/theme';
import VanBlog from '@/types/initialState';
import { useTranslation } from 'react-i18next';
import './index.less';

const trans_zh = {
  'theme.light': '亮色',
  'theme.dark': '暗色',
  'theme.auto': '自动',
  'theme.switch_to': '切换主题',
  'theme.mode.light': '日间',
  'theme.mode.dark': '夜间',
  'theme.mode.auto': '自动',
};

interface ThemeButtonProps {
  showText: boolean;
  className?: string;
}

// Extended settings interface with theme properties
interface ExtendedSettings {
  theme?: 'auto' | 'light' | 'dark';
  navTheme?: string;
  [key: string]: unknown;
}

export default function ThemeButton({ showText, className = '' }: ThemeButtonProps) {
  const { initialState, setInitialState } = useModel();
  const { t } = useTranslation();

  const updateTheme = (newTheme: 'auto' | 'light' | 'dark') => {
    const curInitialState: VanBlog.InitialState = { ...initialState };
    if (curInitialState.settings) {
      // Using the extended settings interface
      const settings = curInitialState.settings as ExtendedSettings;
      settings.theme = newTheme;

      // Update navTheme based on the effective theme (accounting for auto mode)
      const effectiveTheme = newTheme === 'auto' ? decodeAutoTheme() : newTheme;
      settings.navTheme = effectiveTheme === 'dark' ? 'realDark' : 'light';

      // Update context state
      setInitialState(curInitialState);

      // Apply theme via utility function (also updates localStorage)
      setTheme(newTheme);

      console.log('[Theme] Changed to:', newTheme);
    }
  };

  // Add effect to listen for system theme changes when in auto mode
  useEffect(() => {
    // This is now handled by setupThemeListener in theme service
    // No need for duplicate listeners here
  }, [initialState?.settings]);

  const settings = initialState?.settings as ExtendedSettings;
  const theme = settings?.theme || readTheme() || 'auto';

  // Initialize theme on component mount
  useEffect(() => {
    const savedTheme = readTheme() || 'auto';

    // Apply theme via service function
    applyThemeToDOM(savedTheme);

    // Sync theme with initialState if needed
    const settings = initialState?.settings as ExtendedSettings;
    if (settings && settings.theme !== savedTheme) {
      updateTheme(savedTheme);
    }
  }, []);

  const handleSwitch = () => {
    if (!initialState || !initialState.settings) return;
    // light -> dark -> auto -> light
    if (theme === 'light') {
      updateTheme('dark');
    } else if (theme === 'dark') {
      updateTheme('auto');
    } else {
      updateTheme('light');
    }
  };

  const iconSize = 16;

  // Create an icon component matching the structure of other menu items
  const ThemeIcon = () => {
    if (theme === 'light') {
      return (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '14px',
            fontSize: '14px',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width={iconSize}
            height={iconSize}
            fill="currentColor"
            style={{ marginRight: 0 }}
          >
            <path d="M12 18C8.68629 18 6 15.3137 6 12C6 8.68629 8.68629 6 12 6C15.3137 6 18 8.68629 18 12C18 15.3137 15.3137 18 12 18Z" />
          </svg>
        </span>
      );
    } else if (theme === 'dark') {
      return (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '14px',
            fontSize: '14px',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width={iconSize}
            height={iconSize}
            fill="currentColor"
            style={{ marginRight: 0 }}
          >
            <path d="M10 7C10 10.866 13.134 14 17 14C18.9584 14 20.729 13.1957 22 11.8995C21.3608 16.3743 17.3659 19.7499 12.5 19.7499C6.97715 19.7499 2.5 15.2728 2.5 9.74994C2.5 6.07277 4.60504 2.88202 7.70435 1.5C7.25167 3.15141 7 4.92169 7 6.75C7 11.5941 10.4059 15 15.25 15C16.3954 15 17.4908 14.7958 18.4904 14.4241C15.2137 16.3482 10.6886 15.0249 10 7Z" />
          </svg>
        </span>
      );
    } else {
      return (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '14px',
            fontSize: '14px',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width={iconSize}
            height={iconSize}
            fill="currentColor"
            style={{ marginRight: 0 }}
          >
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 11.5373 21.3065 11.4608 21.0672 11.8568C19.9289 13.7406 17.8615 15 15.5 15C11.9101 15 9 12.0899 9 8.5C9 6.13845 10.2594 4.07105 12.1432 2.93276C12.5392 2.69346 12.4627 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
          </svg>
        </span>
      );
    }
  };

  // Use the same structure as other menu links
  return (
    <a
      className={`theme-link ${className}`}
      onClick={handleSwitch}
      style={{ display: 'flex', alignItems: 'center', width: '100%', height: '100%' }}
    >
      <ThemeIcon />
      {showText && (
        <span style={{ marginLeft: '10px', transition: 'opacity 0.3s' }}>
          {theme === 'light' && t('common.lightMode', trans_zh['theme.mode.light'])}
          {theme === 'dark' && t('common.darkMode', trans_zh['theme.mode.dark'])}
          {theme === 'auto' && t('common.autoMode', trans_zh['theme.mode.auto'])}
        </span>
      )}
    </a>
  );
}
