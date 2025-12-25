import type { BytemdPlugin } from 'bytemd';
import rehypeRaw from 'rehype-raw';

export const rawHTML = (): BytemdPlugin => {
  return {
    rehype: (processor) => processor.use(rehypeRaw),
  };
};
