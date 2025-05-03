/**
 * Theme utility functions for managing theme state
 */

import { getInitTheme, mapTheme, writeTheme, setupThemeListener } from '@/services/van-blog/theme';

export type ThemeType = 'light' | 'dark' | 'auto';

/**
 * Gets current theme setting (auto, light, or dark)
 */
export const readTheme = () => {
  return getInitTheme();
};

/**
 * Sets theme and applies it to DOM
 * @param theme 'auto' | 'light' | 'dark'
 */
export const setTheme = (theme: 'auto' | 'light' | 'dark') => {
  return writeTheme(theme);
};

/**
 * Converts theme setting to Ant Design theme value
 * @param theme The current theme setting
 * @returns 'light' | 'realDark'
 */
export const getAntdTheme = (theme: string) => {
  return mapTheme(theme);
};

/**
 * Sets up system theme change listener
 * Returns cleanup function
 */
export const initThemeListener = () => {
  return setupThemeListener();
};
