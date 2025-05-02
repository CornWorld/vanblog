import { BytemdPlugin } from 'bytemd';
import remarkDirective from 'remark-directive';
import { visit } from 'unist-util-visit';
import i18next, { TFunction } from 'i18next';
import { icons } from './icons';

const CUSTOM_CONTAINER_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 1024 1024"><path d="M157.4 966.004a99.435 99.435 0 0 1-99.334-99.287V668.09a99.468 99.468 0 0 1 99.333-99.287h709.323a99.425 99.425 0 0 1 99.282 99.287v198.626a99.393 99.393 0 0 1-99.282 99.287zm-14.2-297.913v198.626a14.234 14.234 0 0 0 14.2 14.199h709.322a14.233 14.233 0 0 0 14.199-14.2V668.092a14.266 14.266 0 0 0-14.2-14.199H157.4a14.266 14.266 0 0 0-14.198 14.2zm14.2-212.824a99.436 99.436 0 0 1-99.334-99.288V157.353a99.468 99.468 0 0 1 99.333-99.287h709.323a99.424 99.424 0 0 1 99.282 99.287V355.98a99.393 99.393 0 0 1-99.282 99.287zM143.2 157.353V355.98a14.233 14.233 0 0 0 14.2 14.199h709.32a14.233 14.233 0 0 0 14.2-14.2V157.354a14.266 14.266 0 0 0-14.2-14.199H157.4a14.267 14.267 0 0 0-14.198 14.2z"/></svg>';

const getContainerActions = () => [
  {
    title: 'info',
    code: `:::info{title="${i18next.t('editor.customContainer.info')}"}\n${i18next.t('editor.customContainer.info')}\n:::`,
  },
  {
    title: 'note',
    code: `:::note{title="${i18next.t('editor.customContainer.note')}"}\n${i18next.t('editor.customContainer.note')}\n:::`,
  },
  {
    title: 'warning',
    code: `:::warning{title="${i18next.t('editor.customContainer.warning')}"}\n${i18next.t('editor.customContainer.warning')}\n:::`,
  },
  {
    title: 'danger',
    code: `:::danger{title="${i18next.t('editor.customContainer.danger')}"}\n${i18next.t('editor.customContainer.danger')}\n:::`,
  },
  {
    title: 'tip',
    code: `:::tip{title="${i18next.t('editor.customContainer.tip')}"}\n${i18next.t('editor.customContainer.tip')}\n:::`,
  },
];

const getContainerTitles = () => ({
  note: i18next.t('editor.customContainer.note'),
  info: i18next.t('editor.customContainer.info'),
  warning: i18next.t('editor.customContainer.warning'),
  danger: i18next.t('editor.customContainer.danger'),
  tip: i18next.t('editor.customContainer.tip'),
});

// Disable rule for this complex case with unist/remark
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const customContainerPlugin = () => (tree: any) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  visit(tree, (node: any) => {
    if (
      node.type === 'textDirective' ||
      node.type === 'leafDirective' ||
      node.type === 'containerDirective'
    ) {
      if (node.type == 'containerDirective') {
        const { attributes, name } = node;
        const data = (node.data ??= {
          /* intentionally empty */
        });
        const tagName = name || '';
        const CUSTOM_CONTAINER_TITLE = getContainerTitles();

        // Check if tagName is a valid key in the CUSTOM_CONTAINER_TITLE object
        const isValidKey = (key: string): key is keyof typeof CUSTOM_CONTAINER_TITLE =>
          Object.keys(CUSTOM_CONTAINER_TITLE).includes(key);

        const title =
          attributes?.title || (isValidKey(tagName) ? CUSTOM_CONTAINER_TITLE[tagName] : undefined);

        const cls = `custom-container ${tagName}`;

        data.hName = 'div';
        data.hProperties = {
          class: cls,
          ['type']: title,
        };
      }
    }
  });
};

export function customContainer({ t }: { t: TFunction }): BytemdPlugin {
  return {
    remark: (processor) => processor.use(remarkDirective).use(customContainerPlugin),

    viewerEffect: ({ markdownBody }) => {
      const elements = markdownBody.querySelectorAll('.custom-container');

      elements.forEach((element) => {
        const type = element.className.replace('custom-container', '').trim();
        const title = element.getAttribute('type');
        const titleEl = document.createElement('p');

        titleEl.className = `custom-container-title ${title}`;

        const icon = icons[type];
        const html = `${icon}<span>${title}</span>`;

        titleEl.innerHTML = html;

        element.insertBefore(titleEl, element.firstChild);
      });
    },

    actions: [
      {
        title: t('editor.customContainer.title'),
        icon: CUSTOM_CONTAINER_ICON,
        cheatsheet: t('editor.customContainer.cheatsheet'),
        handler: {
          type: 'dropdown',
          actions: getContainerActions().map(({ title, code }) => ({
            title,
            handler: {
              type: 'action',

              click: ({ editor, appendBlock, codemirror }) => {
                const line = appendBlock(code);

                // Safely handle Position + number issue
                try {
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-ignore
                  editor.setSelection(codemirror.Pos(line + 1, 0), codemirror.Pos(line + 1));
                  editor.focus();
                } catch (err) {
                  console.error('Error setting selection:', err);
                  editor.focus();
                }
              },
            },
          })),
        },
      },
    ],
  };
}
