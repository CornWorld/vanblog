import { BytemdPlugin } from 'bytemd';
import { TFunction } from 'i18next';
import { icons } from '../icons';

interface InsertMoreOptions {
  t?: TFunction;
}

export function insertMore(options?: InsertMoreOptions): BytemdPlugin {
  const { t } = options || {};

  const getTranslation = (key: string) => {
    if (t) return t(key);
    return key.split('.').pop() || key;
  };

  return {
    actions: [
      {
        title: getTranslation('editor.more.title'),
        icon: icons.insertMore,
        handler: {
          type: 'action',
          click(ctx) {
            ctx.appendBlock('\n<!-- more -->\n\n');
          },
        },
      },
    ],
  };
}
