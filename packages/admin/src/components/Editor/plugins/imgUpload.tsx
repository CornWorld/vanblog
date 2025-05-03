import i18next, { TFunction } from 'i18next';
import { copyImgLink, getImgLink } from '@/pages/ImageManage/components/tools';
import { message as antMessage } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';
import { BytemdPlugin } from 'bytemd';
import { icons } from '../icons';

// Define types for bytemd context
interface Position {
  line: number;
  ch: number;
}

interface EditorContext {
  appendBlock: (text: string) => Position;
  editor: {
    setSelection: (from: Position, to: Position) => void;
    focus: () => void;
  };
  codemirror: {
    Pos: (line: number) => Position;
  };
}

// Define a MessageAPI interface to match Ant Design's message API shape
interface MessageAPI {
  success: (content: string) => void;
  error: (content: string) => void;
  warning: (content: string) => void;
  info: (content: string) => void;
}

// This function helps to use message API with App context when available
const createMessage = (messageApi: MessageInstance | MessageAPI = antMessage): MessageAPI => {
  // Return a message object that works with both static and App-based message API
  return {
    success: (content: string) => messageApi.success(content),
    error: (content: string) => messageApi.error(content),
    warning: (content: string) => messageApi.warning(content),
    info: (content: string) => messageApi.info(content),
  };
};

// Always create a default message instance for fallback
const defaultMessage = createMessage();

export const uploadImg = async (file: File, options?: { t?: TFunction; message?: MessageAPI }) => {
  const t = options?.t || i18next.t;
  const message = options?.message || defaultMessage;
  const formData = new FormData();
  formData.append('file', file);
  try {
    // Check if the file is an SVG
    const isSvg = file.type === 'image/svg+xml';

    // For SVGs, read the file directly and return as a data URI to avoid server upload issues
    if (isSvg) {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          // If the result is already a data URI, return it directly
          if (result.startsWith('data:image/svg+xml;base64,')) {
            resolve(result);
          } else {
            // Otherwise, create a valid data URI
            const svgContent = result;
            const base64Content = btoa(svgContent);
            resolve(`data:image/svg+xml;base64,${base64Content}`);
          }
        };
        reader.onerror = () => {
          message.error(t('editor.imgUpload.fail'));
        };
        reader.readAsText(file);
      });
    }

    // For non-SVG files, proceed with normal upload
    const res = await fetch('/api/admin/img/upload?withWaterMark=true', {
      method: 'POST',
      body: formData,
      headers: {
        token: (() => {
          return window.localStorage.getItem('token') || 'null';
        })(),
      },
    });
    const data = await res.json();
    if (data && data.statusCode == 200) {
      const url = getImgLink(data.data.src, false);
      copyImgLink(data.data.src, true, t('editor.imgUpload.success'));
      return url;
    } else {
      message.error(t('editor.imgUpload.fail'));
      return null;
    }
  } catch {
    // Log a general error message without exposing error details to the user
    message.error(t('editor.imgUpload.fail'));
    return null;
  }
};

interface ImgUploadPluginOptions {
  t?: TFunction;
  message?: MessageAPI | MessageInstance;
}

export function imgUploadPlugin(
  setLoading: (loading: boolean) => void,
  options?: ImgUploadPluginOptions,
): BytemdPlugin {
  const { t, message: messageApi } = options || {};
  // Create message API helper
  const message = messageApi ? createMessage(messageApi) : defaultMessage;
  // Fallback to i18next.t if t is not provided
  const translationFunc = t || i18next.t;

  const getTranslation = (key: string) => {
    if (translationFunc) return translationFunc(key);
    return key.split('.').pop() || key;
  };

  // Create a stable handler function that doesn't change on each render
  const handleClick = (ctx: EditorContext) => {
    setLoading(true);
    // Handle clipboard paste manually since we can't directly import getClipboardContents
    navigator.clipboard
      .read()
      .then(async (clipboardItems) => {
        let file = null;
        for (const clipboardItem of clipboardItems) {
          for (const type of clipboardItem.types) {
            if (type.startsWith('image/')) {
              const blob = await clipboardItem.getType(type);
              file = new File([blob], `clipboard-image.${type.split('/')[1]}`, { type });
              break;
            }
          }
          if (file) break;
        }

        if (file) {
          uploadImg(file, { t: translationFunc, message }).then((url) => {
            if (url) {
              const imgs = [{ url: url, alt: file.name, title: file.name }];
              const pos = ctx.appendBlock(
                imgs
                  .map(({ url, alt, title }) => {
                    return `![${alt}](${url}${title ? ` "${title}"` : ''})`;
                  })
                  .join('\n\n'),
              );
              ctx.editor.setSelection(pos, ctx.codemirror.Pos(pos.line + imgs.length * 2 - 2));
              ctx.editor.focus();
            }
          });
        } else {
          message.warning(translationFunc('editor.imgUpload.noImage'));
        }
      })
      .catch((error: Error) => {
        console.error('Failed to process clipboard contents:', error);
        message.warning(translationFunc('editor.imgUpload.uploadFail'));
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return {
    actions: [
      {
        title: getTranslation('editor.imgUpload.title'),
        icon: icons.imgUpload,
        handler: {
          type: 'action',
          click: handleClick,
        },
      },
    ],
  };
}
