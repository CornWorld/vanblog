import { visit } from 'unist-util-visit';
import type { BytemdPlugin } from 'bytemd';
import m from 'medium-zoom';
const ImgZoomPlugin = () => (tree: any) => {
  visit(tree, (node) => {
    if (node.type === 'element' && node.tagName === 'img') {
      node.properties.className += ' img-zoom';
    }
  });
};

export function Img(): BytemdPlugin {
  return {
    rehype: (processor) => processor.use(ImgZoomPlugin),
    viewerEffect: ({ markdownBody }) => {
      markdownBody.querySelectorAll('.img-zoom').forEach((img) => {
        const element = img as HTMLImageElement;
        if (element.getAttribute('data-zoomed')) return;
        element.setAttribute('data-zoomed', 'true');
        m(element);
      });
    },
  };
}
