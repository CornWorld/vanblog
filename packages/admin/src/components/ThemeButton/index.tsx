import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from 'react-i18next';
import './index.less';

interface ThemeButtonProps {
  showText: boolean;
  className?: string;
}

export default function ThemeButton({ showText, className = '' }: ThemeButtonProps) {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();

  const handleSwitch = () => {
    // 切换主题顺序：light -> dark -> auto -> light
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('auto');
    } else {
      setTheme('light');
    }
  };

  const iconSize = 16;

  // 根据当前主题渲染适当的图标
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

  // 获取主题模式的名称
  const getThemeName = () => {
    switch (theme) {
      case 'light':
        return t('theme.mode.light');
      case 'dark':
        return t('theme.mode.dark');
      case 'auto':
        return t('theme.mode.auto');
      default:
        return '';
    }
  };

  // 使用与菜单项相同的结构
  return (
    <a
      className={`theme-link ${className}`}
      onClick={handleSwitch}
      style={{ display: 'flex', alignItems: 'center', width: '100%', height: '100%' }}
    >
      <ThemeIcon />
      {showText && (
        <span style={{ marginLeft: '10px', transition: 'opacity 0.3s' }}>{getThemeName()}</span>
      )}
    </a>
  );
}
