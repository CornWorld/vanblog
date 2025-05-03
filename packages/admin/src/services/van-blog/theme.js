export const getInitTheme = () => {
  // Check if theme is in localStorage
  if (!('theme' in localStorage)) {
    return 'auto'; // Default to auto if not set
  }

  // Return the theme value from localStorage (light, dark, or auto)
  return localStorage.theme;
};

export const decodeAutoTheme = () => {
  // Determine actual theme based on system preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const mapTheme = (theme) => {
  // Map to UI framework theme values:
  // 'auto' -> actual theme based on system preference
  // 'light' -> 'light'
  // 'dark' -> 'realDark'

  if (theme === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'realDark' : 'light';
  }

  return theme === 'dark' ? 'realDark' : 'light';
};

export const applyThemeToDOM = (theme) => {
  // Get actual theme (accounting for auto)
  const effectiveTheme = theme === 'auto' ? decodeAutoTheme() : theme;

  // Apply to body classes
  document.body.classList.remove('light-theme', 'dark-theme', 'dark-theme-body');
  document.body.classList.add(`${effectiveTheme}-theme`);

  // Add special body class for dark theme
  if (effectiveTheme === 'dark') {
    document.body.classList.add('dark-theme-body');
  }

  // Update data-theme attribute (crucial for CSS selectors)
  document.documentElement.setAttribute('data-theme', effectiveTheme);

  // Update Ant Design theme classes and color scheme
  if (effectiveTheme === 'dark') {
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
  }

  // Apply ByteMD theme changes
  applyBytemdDarkMode(effectiveTheme === 'dark');

  console.log('[Theme] Applied:', effectiveTheme);

  // Return the effective theme for potential use by callers
  return effectiveTheme;
};

const applyBytemdDarkMode = (isDark) => {
  try {
    const bytemdElements = document.querySelectorAll('.bytemd');
    if (bytemdElements && bytemdElements.length > 0) {
      bytemdElements.forEach((editor) => {
        if (isDark) {
          editor.style.setProperty('--bg-color', '#141414');
          editor.style.setProperty('--border-color', '#303030');
          editor.style.setProperty('--color', 'rgba(255, 255, 255, 0.65)');
        } else {
          editor.style.removeProperty('--bg-color');
          editor.style.removeProperty('--border-color');
          editor.style.removeProperty('--color');
        }
      });
    }
  } catch (e) {
    console.warn('Failed to apply ByteMD theme:', e);
  }
};

export const setupThemeListener = () => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handleThemeChange = () => {
    // Only update if current theme is 'auto'
    if (localStorage.theme === 'auto') {
      applyThemeToDOM('auto');
    }
  };

  // Initial application
  const currentTheme = localStorage.theme || 'auto';
  applyThemeToDOM(currentTheme);

  // Add listener for system theme changes
  mediaQuery.addEventListener('change', handleThemeChange);

  // Return cleanup function
  return () => mediaQuery.removeEventListener('change', handleThemeChange);
};

export const writeTheme = (theme) => {
  // Save to localStorage
  localStorage.theme = theme;

  // Apply theme to DOM
  applyThemeToDOM(theme);

  return theme;
};
