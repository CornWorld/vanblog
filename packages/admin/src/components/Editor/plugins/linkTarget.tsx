import { BytemdPlugin } from 'bytemd';
import { visit } from 'unist-util-visit';
import type { Node } from 'unist';

// 定义具有元素属性的接口
interface ElementNode extends Node {
  type: 'element';
  tagName: string;
  properties: {
    [key: string]: string | boolean | number | null | undefined;
    target?: string;
    rel?: string;
  };
}

// 类型守卫函数，用于检查节点是否为元素节点
function isElementNode(node: Node): node is ElementNode {
  return node.type === 'element' && 'tagName' in node && 'properties' in node;
}

const aTargetPlugin = () => (tree: Node) => {
  visit(tree, (node) => {
    if (isElementNode(node) && node.tagName === 'a') {
      node.properties.target = '_blank';
      node.properties.rel = 'noopener noreferrer';
    }
  });
};

export function LinkTarget(): BytemdPlugin {
  return {
    rehype: (processor) => processor.use(aTargetPlugin),
  };
}
