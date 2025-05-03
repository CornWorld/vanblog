import { message } from 'antd';

export const writeClipBoardText = (text, successMsg = '复制成功', failMsg = '复制失败') => {
  try {
    navigator.clipboard.writeText(text);
    message.success(successMsg);
  } catch {
    message.error(failMsg);
  }
};

/**
 * 从剪贴板获取内容（主要是图片文件）
 * @returns {Promise<File|null>} 返回文件对象，如果没有找到图片则返回null
 */
export const getClipboardContents = async () => {
  try {
    // 使用Clipboard API读取剪贴板内容
    const items = await navigator.clipboard.read();

    // 遍历剪贴板项目
    for (const clipboardItem of items) {
      // 获取所有可用的MIME类型
      for (const type of clipboardItem.types) {
        // 检查是否为图片类型
        if (type.startsWith('image/')) {
          // 获取该类型的Blob
          const blob = await clipboardItem.getType(type);
          // 创建一个File对象
          return new File([blob], `clipboard-image.${type.split('/')[1]}`, { type });
        }
      }
    }

    // 如果没有找到图片内容
    return null;
  } catch (error) {
    console.error('Failed to read clipboard contents:', error);
    return null;
  }
};
