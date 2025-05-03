import React, { useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';

/**
 * BytemdThemeProvider 组件负责将主题应用到 ByteMD 编辑器
 * 它不渲染任何内容，仅监听主题变化并应用到 ByteMD 元素
 */
const BytemdThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { effectiveTheme } = useTheme();

  // 当主题变化时应用到 ByteMD 编辑器
  useEffect(() => {
    // 使用CSS变量与类名标记编辑器元素
    const markBytemdElements = () => {
      const bytemdElements = document.querySelectorAll('.bytemd');
      if (bytemdElements && bytemdElements.length > 0) {
        bytemdElements.forEach((editor) => {
          const editorEl = editor as HTMLElement;
          editorEl.classList.add('theme-applied');
          editorEl.setAttribute('data-theme', effectiveTheme);
        });
      }
    };

    // 初始执行一次
    markBytemdElements();

    // 创建一个观察器来检测动态添加的 ByteMD 编辑器
    const observer = new MutationObserver(() => {
      markBytemdElements();
    });

    // 开始观察 document.body 的子元素变化
    observer.observe(document.body, { childList: true, subtree: true });

    // 清理函数
    return () => observer.disconnect();
  }, [effectiveTheme]);

  return <>{children}</>;
};

export default BytemdThemeProvider;
