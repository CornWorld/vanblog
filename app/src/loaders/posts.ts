import type { LiveLoader } from 'astro/loaders';
import { createVanblogClient, type Post } from '@vanblog/sdk';
import { renderMarkdown } from '../lib/markdown/renderer';

const PB_URL = 'http://127.0.0.1:8090';

/** Filter type for getLiveEntry */
export interface PostEntryFilter {
  id: string;
}

/** Filter type for getLiveCollection */
export interface PostCollectionFilter {
  page?: number;
  perPage?: number;
  category?: string;
  tag?: string;
}

export function postLoader(): LiveLoader<Post, PostEntryFilter, PostCollectionFilter> {
  const client = createVanblogClient({ url: PB_URL });

  return {
    name: 'vanblog-posts',

    async loadEntry({ filter }) {
      try {
        const post = await client.collection('posts').getOne<Post>(filter.id);

        // Only serve published, non-deleted posts via live loader
        if (post.status !== 'published' || post.deleted) {
          return undefined;
        }

        const { code: html } = await renderMarkdown(post.content || '');

        return {
          id: post.id,
          data: post,
          rendered: { html },
          cacheHint: {
            tags: ['posts', `post:${post.id}`],
            lastModified: new Date(post.updated),
          },
        };
      } catch {
        return undefined;
      }
    },

    async loadCollection({ filter }) {
      try {
        const page = filter?.page ?? 1;
        const perPage = filter?.perPage ?? 10;
        const filters: string[] = ['status="published"', 'deleted=false'];

        if (filter?.category) {
          filters.push(`category.name="${filter.category}"`);
        }
        if (filter?.tag) {
          filters.push(`tags.name="${filter.tag}"`);
        }

        const result = await client.collection('posts').getList<Post>(page, perPage, {
          filter: filters.join(' && '),
          sort: '-created',
          expand: 'category,tags,author',
        });

        const entries = await Promise.all(
          result.items.map(async (post) => {
            const { code: html } = await renderMarkdown(post.content || '');
            return {
              id: post.id,
              data: post,
              rendered: { html },
              cacheHint: {
                tags: ['posts', `post:${post.id}`],
                lastModified: new Date(post.updated),
              },
            };
          }),
        );

        return {
          entries,
          cacheHint: {
            tags: ['posts'],
          },
        };
      } catch {
        return { entries: [] };
      }
    },
  };
}
