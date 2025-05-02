import { BytemdPlugin } from 'bytemd';
import { TFunction } from 'i18next';
import { icons } from '../icons';

export function historyIcon({ t }: { t: TFunction }): BytemdPlugin {
  return {
    actions: [
      {
        position: 'left',
        title: t('editor.history.undo'),
        icon: icons.undo, // 16x16 SVG icon

        handler: {
          type: 'action',
          click(ctx) {
            ctx.editor.undo();
          },
        },
      },
      {
        position: 'left',
        title: t('editor.history.redo'),
        icon: icons.redo, // 16x16 SVG icon
        handler: {
          type: 'action',
          click(ctx) {
            ctx.editor.redo();
          },
        },
      },
    ],
  };
}
