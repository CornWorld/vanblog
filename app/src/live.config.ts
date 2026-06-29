import { defineLiveCollection } from 'astro:content';
import { postLoader } from './loaders/posts';

const posts = defineLiveCollection({
  loader: postLoader(),
});

export const collections = { posts };
