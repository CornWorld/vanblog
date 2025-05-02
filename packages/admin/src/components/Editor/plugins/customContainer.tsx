import { BytemdPlugin } from 'bytemd';
import remarkDirective from 'remark-directive';
import { visit } from 'unist-util-visit';
import i18next, { TFunction } from 'i18next';
import { icons } from '../icons';

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

// Interface for the AST node from remark
interface RemarkNode {
  type: string;
  name?: string;
  attributes?: Record<string, string>;
  data?: {
    hName?: string;
    hProperties?: {
      className?: string[];
      type?: string;
      [key: string]: unknown;
    };
  };
}

// Plugin that handles custom containers
const customContainerPlugin = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (tree: any) => {
    visit(tree, (node: RemarkNode) => {
      if (
        node.type === 'textDirective' ||
        node.type === 'leafDirective' ||
        node.type === 'containerDirective'
      ) {
        const data = node.data || (node.data = {});
        const type = node.name;
        const attrs = node.attributes || {};
        const title = attrs.title || type;

        if (type && ['tip', 'warning', 'danger', 'info', 'note'].includes(type)) {
          // Add class for styling
          data.hName = 'div';
          data.hProperties = {
            className: ['custom-container', type],
            type: title,
          };
        }
      }
    });
  };
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
        icon: icons.customContainer,
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
