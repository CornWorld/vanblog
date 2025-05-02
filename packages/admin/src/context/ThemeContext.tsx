import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

export type ThemeType = 'light' | 'dark' | 'auto';

interface ThemeContextType {
  theme: ThemeType;
  effectiveTheme: 'light' | 'dark'; // 实际应用的主题，考虑 auto 后的结果
  setTheme: (theme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// 从 localStorage 获取保存的主题，默认为 auto
const getSavedTheme = (): ThemeType => {
  if (typeof window === 'undefined') return 'auto';
  return (localStorage.getItem('theme') as ThemeType) || 'auto';
};

// 解析 auto 主题为实际的 light 或 dark
const resolveAutoTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

// 将 Ant Design 主题映射
export const mapAntdTheme = (theme: ThemeType, effectiveTheme: 'light' | 'dark') => {
  return effectiveTheme === 'dark' ? 'realDark' : 'light';
};

// 主题配置 - 定义所有使用的 CSS 变量
const themeVars = {
  light: {
    // 通用色彩
    '--color-bg-base': '#fff',
    '--color-text-primary': '#333',
    '--color-text-secondary': 'rgba(0, 0, 0, 0.65)',
    '--color-text-tertiary': 'rgba(0, 0, 0, 0.45)',
    '--color-border': '#e8e8e8',
    '--color-divider': 'rgba(0, 0, 0, 0.06)',
    '--color-shadow': 'rgba(0, 0, 0, 0.15)',

    // 特定组件色彩
    '--card-bg': '#fff',
    '--card-header-bg': '#fff',
    '--sidebar-bg': '#fff',
    '--sidebar-text': 'rgba(0, 0, 0, 0.65)',
    '--menu-item-bg': 'transparent',
    '--menu-item-hover': '#f5f5f5',
    '--menu-item-active-bg': '#e6f7ff',
    '--menu-item-active-text': '#1890ff',

    // 代码编辑器
    '--editor-bg': '#fff',
    '--editor-text': '#333',
    '--editor-border': '#d9d9d9',
  },
  dark: {
    // 通用色彩
    '--color-bg-base': '#141414',
    '--color-text-primary': 'rgba(255, 255, 255, 0.85)',
    '--color-text-secondary': 'rgba(255, 255, 255, 0.65)',
    '--color-text-tertiary': 'rgba(255, 255, 255, 0.45)',
    '--color-border': '#303030',
    '--color-divider': 'rgba(255, 255, 255, 0.08)',
    '--color-shadow': 'rgba(0, 0, 0, 0.45)',

    // 特定组件色彩
    '--card-bg': '#1f1f1f',
    '--card-header-bg': '#1f1f1f',
    '--sidebar-bg': '#141414',
    '--sidebar-text': 'rgba(255, 255, 255, 0.65)',
    '--menu-item-bg': 'transparent',
    '--menu-item-hover': '#111',
    '--menu-item-active-bg': '#111b26',
    '--menu-item-active-text': '#177ddc',

    // 代码编辑器
    '--editor-bg': '#141414',
    '--editor-text': 'rgba(255, 255, 255, 0.65)',
    '--editor-border': '#303030',
  },
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 存储当前主题设置 (auto, light, dark)
  const [theme, setThemeState] = useState<ThemeType>(getSavedTheme());

  // 存储实际显示的主题 (仅 light 或 dark)
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>(
    theme === 'auto' ? resolveAutoTheme() : (theme as 'light' | 'dark'),
  );

  // 处理主题变更
  const setTheme = (newTheme: ThemeType) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Theme] Setting theme:', newTheme);
    }
    // 保存主题到 localStorage
    localStorage.setItem('theme', newTheme);

    // 更新状态
    setThemeState(newTheme);

    // 更新实际主题
    if (newTheme === 'auto') {
      setEffectiveTheme(resolveAutoTheme());
    } else {
      setEffectiveTheme(newTheme);
    }
  };

  // 监听系统主题变化（仅当主题设置为 auto 时生效）
  useEffect(() => {
    if (theme !== 'auto') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      setEffectiveTheme(resolveAutoTheme());
    };

    mediaQuery.addEventListener('change', handleChange);

    // 清理函数
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // 应用主题 CSS 变量到 DOM
  useEffect(() => {
    if (typeof document === 'undefined') return;

    // 设置 data-theme 属性以便可以继续使用 CSS 选择器
    document.documentElement.setAttribute('data-theme', effectiveTheme);

    // 应用该主题的所有 CSS 变量
    const themeValues = themeVars[effectiveTheme];
    for (const [key, value] of Object.entries(themeValues)) {
      document.documentElement.style.setProperty(key, value);
    }

    // 基础类名（为了兼容性）
    document.body.classList.remove('light-theme', 'dark-theme', 'dark-theme-body');
    document.body.classList.add(`${effectiveTheme}-theme`);

    if (effectiveTheme === 'dark') {
      document.body.classList.add('dark-theme-body');
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
  }, [effectiveTheme]);

  // 首次加载时应用保存的主题
  useEffect(() => {
    const savedTheme = getSavedTheme();
    if (savedTheme !== theme) {
      setTheme(savedTheme);
    }
  }, []);

  // 使用 useMemo 优化 context 值，避免不必要的组件重渲染
  const contextValue = useMemo(
    () => ({
      theme,
      effectiveTheme,
      setTheme,
    }),
    [theme, effectiveTheme],
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
};

export default ThemeContext;
