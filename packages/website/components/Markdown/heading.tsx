import React from 'react';
import { BytemdPlugin } from 'bytemd';
import { visit } from 'unist-util-visit';

/**
 * Converts a string into a URL-friendly slug
 */
function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFKD')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

interface HeadingComponentProps {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: React.ReactNode;
}

// Creates heading elements (h1, h2, etc.) with anchor links for navigation
const HeadingComponent = ({ level, children }: HeadingComponentProps) => {
  const slug = children && typeof children === 'string' ? slugify(children) : '';

  // Use React's built-in typing for HTML elements
  const HeadingTag = `h${level}` as keyof React.JSX.IntrinsicElements;

  // For accessibility and SEO, give the heading an id based on its content
  return React.createElement(HeadingTag, {
    id: slug,
    'data-id': children,
    className: 'group flex whitespace-pre-wrap relative',
    children: [
      // Generate the heading content
      children,

      // Generate the anchor link for direct navigation
      slug &&
        React.createElement('a', {
          href: `#${slug}`,
          className: 'ml-2 opacity-0 group-hover:opacity-100 transition-opacity',
          'aria-hidden': true,
          children: '#',
        }),
    ],
  });
};

interface Node {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: Node[];
  value?: string;
}

// Transform headings in the AST to add slug IDs
const HeadingTransform = () => (tree: Node) => {
  visit(tree, (node: Node) => {
    if (node.type === 'element' && node.tagName && /^h[1-6]$/.test(node.tagName)) {
      // Extract level but don't use it to avoid unused var warning
      // const level = parseInt(node.tagName.substring(1), 10);
      let text = '';

      // Extract text content to create a slug
      visit(node, 'text', (textNode: Node) => {
        if (textNode.value) {
          text += textNode.value;
        }
      });

      if (text && node.properties && node.children) {
        const slug = slugify(text);
        node.properties.id = slug;
        node.properties.className = 'group flex whitespace-pre-wrap relative';

        // Add anchor link
        node.children.push({
          type: 'element',
          tagName: 'a',
          properties: {
            href: `#${slug}`,
            className: 'ml-2 opacity-0 group-hover:opacity-100 transition-opacity',
            'aria-hidden': true,
          },
          children: [{ type: 'text', value: '#' }],
        });
      }
    }
  });
};

export function Heading(): BytemdPlugin {
  return {
    rehype: (processor) => processor.use(HeadingTransform),
  };
}

export default HeadingComponent;
