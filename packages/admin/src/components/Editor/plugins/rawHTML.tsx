import { BytemdPlugin } from 'bytemd';
import rehypeRaw from 'rehype-raw';

export const rawHTML = (): BytemdPlugin => {
  return {
    // @ts-expect-error - Incompatible types between unified/rehype versions
    rehype: (processor) => processor.use(rehypeRaw),
  };
};
