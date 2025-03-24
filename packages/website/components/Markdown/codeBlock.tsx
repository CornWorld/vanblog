import { BytemdPlugin } from 'bytemd';
import { visit } from 'unist-util-visit';
import copy from 'copy-to-clipboard';
import toast from 'react-hot-toast';
import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { coldarkDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import clsx from 'clsx';

// FIXME: Addd Types
const codeBlockPlugin = () => (tree) => {
  visit(tree, (node) => {
    if (node.type === 'element' && node.tagName === 'pre') {
      const oldChildren = JSON.parse(JSON.stringify(node.children));
      const codeProperties = oldChildren.find(
        (child: { tagName: string }) => child.tagName === 'code',
      ).properties;
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
    if (node.type === 'element' && node.tagName === 'code') {
      if (!node?.properties?.className?.includes('hljs')) {
        node.properties.className = ['code-inline', ...(node?.properties?.className || [])];
      }
    }
  });
};

const onClickCopyCode = (e: PointerEvent) => {
  const copyBtn = e.target as HTMLElement;
  const code = copyBtn.parentElement?.parentElement?.querySelector('code')?.innerText;
  copy(code);
  toast.success('复制成功', {
    className: 'toast',
  });
};

export function customCodeBlock(): BytemdPlugin {
  return {
    rehype: (processor) => processor.use(codeBlockPlugin),
    viewerEffect: ({ markdownBody }) => {
      markdownBody.querySelectorAll('.code-block-wrapper').forEach((codeBlock) => {
        const copyBtn = codeBlock.querySelector('.code-copy-btn');
        //remove first
        copyBtn.removeEventListener('click', onClickCopyCode);
        copyBtn.addEventListener('click', onClickCopyCode);
      });
    },
  };
}

interface CodeBlockProps {
  inline: boolean;
  className?: string;
  children: React.ReactNode;
}

const CodeBlock = ({ inline, className, children, ...props }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);

  const match = /language-(\w+)/.exec(className || '');
  const lang = match && match[1] ? match[1] : '';

  const handleCopy = () => {
    if (typeof children === 'string') {
      navigator.clipboard.writeText(children.replace(/\n$/, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return !inline && match ? (
    <div className="relative group">
      <button
        onClick={handleCopy}
        className={clsx(
          'absolute right-2 top-2 w-8 h-8 p-1',
          'rounded border-none',
          'bg-gray-700 text-gray-200',
          'flex items-center justify-center',
          'transition-opacity opacity-0 group-hover:opacity-100 focus:opacity-100',
        )}
        aria-label="Copy code"
        title="Copy code"
      >
        {copied ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M17.663 3.118c.225.015.45.032.673.05C19.876 3.298 21 4.604 21 6.14v9.72c0 1.536-1.124 2.842-2.664 2.972-1.522.128-3.065.254-4.628.366-1.676.121-3.353.22-5.029.272-.535.01-1.07.016-1.604.02-1.328.009-2.41-1.047-2.41-2.34V6.185c0-1.293 1.082-2.348 2.41-2.34 1.794.012 3.586.064 5.37.184 1.369.09 2.735.198 4.096.325.563.052 1.123.113 1.658.18zm.671 2.516a1 1 0 00-.79-.027c-.767.152-1.54.29-2.317.41A60.91 60.91 0 0013 6.251c-1.797.133-3.6.203-5.406.203a1 1 0 00-1.005.995v8.1a1 1 0 001.005.995c1.806 0 3.61-.07 5.406-.204 1.597-.119 3.186-.3 4.764-.539a1 1 0 00.818-.989V6.11a1 1 0 00-.49-.47zm-17 8.223V15a1 1 0 002 0v-.646a.865.865 0 01.534-.798l.343-.213a.865.865 0 00.534-.798V9a1 1 0 00-2 0v.646a.865.865 0 01-.534.798l-.343.214a.865.865 0 00-.534.798z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>
      <SyntaxHighlighter
        style={coldarkDark}
        language={lang}
        PreTag="div"
        className="text-base md:text-sm rounded-md !mt-0"
        showLineNumbers
        wrapLines
        {...props}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    </div>
  ) : (
    <code className={className} {...props}>
      {children}
    </code>
  );
};

export default CodeBlock;
