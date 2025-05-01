import type { BytemdPlugin } from 'bytemd';
import { visit } from 'unist-util-visit';
import copy from 'copy-to-clipboard';
import { message } from 'antd';

// Initialize translation
import i18next from 'i18next';
const t = (key: string) => i18next.t(key);

interface CodeProperties {
  className?: string[];
  [key: string]: unknown;
}

// Define the Node interface for the AST tree
interface Node {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: Node[];
}

// Plugin for customizing code blocks
const codeBlockPlugin = () => (tree: Node) => {
  visit(tree, (node: Node) => {
    if (node.type === 'element' && node.tagName === 'pre') {
      const oldChildren = JSON.parse(JSON.stringify(node.children));
      const codeElement = oldChildren.find(
        (child: { tagName: string }) => child.tagName === 'code',
      );
      const codeProperties = codeElement.properties as CodeProperties;

      let language = '';
      if (codeProperties.className) {
        for (const each of codeProperties.className) {
          if (each.startsWith('language-')) {
            language = each.replace('language-', '');
            break;
          }
        }
      }
      if (language === 'mermaid') return;
      // 复制按钮
      const codeCopyBtn = {
        type: 'element',
        tagName: 'div',
        properties: {
          class: 'code-copy-btn',
        },
        children: [],
      };
      const languageTag = {
        type: 'element',
        tagName: 'span',
        properties: {
          class: 'language-tag mr-1',
          style: 'line-height: 21px',
        },
        children: [
          {
            type: 'text',
            value: language,
          },
        ],
      };
      // 上方右侧 header
      const headerRight = {
        type: 'element',
        tagName: 'div',
        properties: {
          class: 'header-right flex',
          style: 'color: #6f7177',
        },
        children: [languageTag, codeCopyBtn],
      };
      // 包裹的 div
      const wrapperDiv = {
        type: 'element',
        tagName: 'div',
        properties: {
          class: 'code-block-wrapper relative',
        },
        children: [headerRight, ...oldChildren],
      };
      node.children = [wrapperDiv];
    }
  });
};

const onClickCopyCode = (e: MouseEvent) => {
  const copyBtn = e.target as HTMLElement;
  const code = copyBtn.parentElement?.parentElement?.querySelector('code')?.innerText || '';
  copy(code);
  message.success(t('editor.codeBlock.copySuccess'));
};

export function customCodeBlock(): BytemdPlugin {
  return {
    rehype: (processor) => processor.use(codeBlockPlugin),
    viewerEffect: ({ markdownBody }) => {
      markdownBody.querySelectorAll('.code-block-wrapper').forEach((codeBlock) => {
        const copyBtn = codeBlock.querySelector('.code-copy-btn');
        if (copyBtn) {
          // Remove first to avoid duplicate event listeners
          copyBtn.removeEventListener('click', onClickCopyCode as EventListener);
          copyBtn.addEventListener('click', onClickCopyCode as EventListener);
        }
      });
    },
  };
}
