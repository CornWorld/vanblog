import { BytemdPlugin } from 'bytemd';
import { visit } from 'unist-util-visit';
import { TFunction } from 'i18next';

// Define more specific types for tree and node
interface TreeNode {
  type: string;
  tagName?: string;
  children?: Array<{ value?: string }>;
  properties?: Record<string, unknown>;
}

interface HeadingOptions {
  t?: TFunction;
}

const headings = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
const headingPlugin = () => (tree: TreeNode) => {
  visit(tree, (node: TreeNode) => {
    if (node.type === 'element' && node.tagName && headings.includes(node.tagName)) {
      const title = node.children?.[0]?.value;
      if (!node.properties) {
        node.properties = {};
      }
      node.properties['data-id'] = title;
    }
  });
};

export function Heading(options?: HeadingOptions): BytemdPlugin {
  // Not using t now, but keeping the parameter for consistency
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { t } = options || {};

  return {
    rehype: (processor) => processor.use(headingPlugin),
  };
}
