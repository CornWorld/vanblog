import i18next from 'i18next';
import { copyImgLink, getImgLink } from '@/pages/ImageManage/components/tools';
import { message } from 'antd';
import { BytemdPlugin } from 'bytemd';

export const uploadImg = async (file: File) => {
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
          message.error(i18next.t('editor.imgUpload.fail'));
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
      copyImgLink(data.data.src, true, i18next.t('editor.imgUpload.success'));
      return url;
    } else {
      message.error(i18next.t('editor.imgUpload.fail'));
      return null;
    }
  } catch {
    // Log a general error message without exposing error details to the user
    message.error(i18next.t('editor.imgUpload.fail'));
    return null;
  }
};

export function imgUploadPlugin(setLoading: (loading: boolean) => void): BytemdPlugin {
  return {
    actions: [
      {
        title: i18next.t('editor.imgUpload.title'),
        icon: icon, // 16x16 SVG icon
        handler: {
          type: 'action',
          click(ctx) {
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
                  uploadImg(file).then((url) => {
                    if (url) {
                      const imgs = [{ url: url, alt: file.name, title: file.name }];
                      const pos = ctx.appendBlock(
                        imgs
                          .map(({ url, alt, title }) => {
                            return `![${alt}](${url}${title ? ` "${title}"` : ''})`;
                          })
                          .join('\n\n'),
                      );
                      ctx.editor.setSelection(
                        pos,
                        ctx.codemirror.Pos(pos.line + imgs.length * 2 - 2),
                      );
                      ctx.editor.focus();
                    }
                  });
                } else {
                  message.warning(i18next.t('editor.imgUpload.noImage'));
                }
              })
              .catch((error: Error) => {
                console.error('Failed to process clipboard contents:', error);
                message.warning(i18next.t('editor.imgUpload.uploadFail'));
              })
              .finally(() => {
                setLoading(false);
              });
          },
        },
      },
    ],
  };
}

const icon = `<svg
viewBox="0 0 1024 1024"
version="1.1"
xmlns="http://www.w3.org/2000/svg"
p-id="1689"
width="16"
fill="currentColor"
height="16"
>
<path
  d="M768 128h-50.090667A128 128 0 0 0 597.333333 42.666667h-170.666666a128 128 0 0 0-120.576 85.333333H256a128 128 0 0 0-128 128v597.333333a128 128 0 0 0 128 128h512a128 128 0 0 0 128-128V256a128 128 0 0 0-128-128z m-341.333333 0h170.666666a42.666667 42.666667 0 0 1 0 85.333333h-170.666666a42.666667 42.666667 0 0 1 0-85.333333z m384 725.333333a42.666667 42.666667 0 0 1-42.666667 42.666667H256a42.666667 42.666667 0 0 1-42.666667-42.666667V256a42.666667 42.666667 0 0 1 42.666667-42.666667h50.090667A128 128 0 0 0 426.666667 298.666667h170.666666a128 128 0 0 0 120.576-85.333334H768a42.666667 42.666667 0 0 1 42.666667 42.666667v597.333333z"
  p-id="1690"
></path>
</svg>`;
